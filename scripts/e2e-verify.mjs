/* 端到端 API 验证脚本：node scripts/e2e-verify.mjs <port> */
const base = `http://localhost:${process.argv[2] ?? "3456"}`;

async function uploadForm() {
  const form = new FormData();
  form.append("files", new Blob(["AnythingBox 端到端验证内容\n第二行。"], { type: "text/plain" }), "verify.txt");
  form.append("files", new Blob(["name,city,score\n张三,北京,95\n李四,上海,88"], { type: "text/csv" }), "verify.csv");
  form.append("files", new Blob(["MZ fake exe"], { type: "application/x-msdownload" }), "virus.exe");
  const res = await fetch(`${base}/api/files`, { method: "POST", body: form });
  return res;
}

let failed = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    failed += 1;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

const main = async () => {
  console.log("== AnythingBox API 端到端验证 ==");
  console.log("1) 健康检查");
  let res = await fetch(`${base}/api/health`);
  check("health 200", res.status === 200);

  console.log("2) 上传（含应被拒绝的 .exe）");
  res = await uploadForm();
  const up = await res.json();
  check("上传返回 201", res.status === 201, String(res.status));
  check("2 个文件成功", up.files?.length === 2, JSON.stringify(up));
  check(".exe 被拒绝", up.rejected?.length === 1 && up.rejected[0].reason.includes("不支持"));
  const [txt, csv] = up.files;

  console.log("3) 提取文本");
  res = await fetch(`${base}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "extract-text", fileIds: [txt.id] }),
  });
  const t1 = (await res.json()).task;
  check("任务完成", t1.status === "completed", JSON.stringify(t1.errors));
  check("1 个结果", t1.resultIds.length === 1);

  console.log("4) 下载结果文件");
  res = await fetch(`${base}/api/download?resultId=${t1.resultIds[0]}`);
  const text = await res.text();
  check("下载 200", res.status === 200);
  check("内容包含原文", text.includes("端到端验证内容"));
  check("Content-Disposition 存在", Boolean(res.headers.get("content-disposition")));

  console.log("5) CSV → JSON 真实转换");
  res = await fetch(`${base}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "convert", target: "json", fileIds: [csv.id] }),
  });
  const t2 = (await res.json()).task;
  check("任务完成", t2.status === "completed", JSON.stringify(t2.errors));

  console.log("6) ZIP 打包下载");
  res = await fetch(`${base}/api/download?taskId=${t2.id}&zip=1`);
  const buf = Buffer.from(await res.arrayBuffer());
  check("ZIP 200", res.status === 200);
  check("PK 头", buf.subarray(0, 2).toString() === "PK");
  check("体积 > 100B", buf.length > 100, String(buf.length));

  console.log("7) 按任务下载（单结果自动直下）");
  res = await fetch(`${base}/api/download?taskId=${t1.id}`);
  check("200 且为文本", res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/plain"), String(res.status));

  console.log("8) AI 未配置时的明确报错");
  res = await fetch(`${base}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "ai", action: "summarize", fileIds: [txt.id] }),
  });
  const t3 = (await res.json()).task;
  check("任务失败但返回任务记录", t3.status === "failed");
  check("错误信息提到 AI_API_KEY", (t3.errors?.[0]?.error ?? "").includes("AI_API_KEY"), t3.errors?.[0]?.error);

  console.log("9) 参数校验");
  res = await fetch(`${base}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "convert", fileIds: [txt.id] }),
  });
  const err1 = await res.json();
  check("缺 target 返回 400", res.status === 400 && err1.error.includes("target"), JSON.stringify(err1));

  res = await fetch(`${base}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "ai", action: "ask", fileIds: [txt.id], question: "" }),
  });
  check("空问题返回 400", res.status === 400);

  console.log("10) CSV 表格预览");
  res = await fetch(`${base}/api/files/${csv.id}/preview`);
  const pv = await res.json();
  check("预览 200", res.status === 200);
  check("表格 2 行", pv.table?.rows?.length === 2, JSON.stringify(pv.table));
  check("字段正确", pv.table?.fields?.join(",") === "name,city,score");

  console.log("11) 删除文件");
  res = await fetch(`${base}/api/files/${txt.id}`, { method: "DELETE" });
  check("删除 200", res.status === 200);
  res = await fetch(`${base}/api/files/${txt.id}`);
  check("再查 404", res.status === 404);

  console.log("12) 任务列表与级联删除");
  res = await fetch(`${base}/api/tasks`);
  const tasks = (await res.json()).tasks;
  check("任务 >= 3", tasks.length >= 3, String(tasks.length));
  const target = tasks.find((t) => t.id === t1.id);
  res = await fetch(`${base}/api/tasks?id=${target.id}`, { method: "DELETE" });
  check("删除任务 200", res.status === 200);
  res = await fetch(`${base}/api/download?taskId=${target.id}`);
  check("结果文件随之删除（404）", res.status === 404, String(res.status));

  console.log("13) 清空全部数据");
  res = await fetch(`${base}/api/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "RESET" }) });
  check("重置 200", res.status === 200);
  const st = (await res.json()).stats;
  check("统计归零", st.fileCount === 0 && st.taskCount === 0 && st.resultCount === 0, JSON.stringify(st));

  console.log(failed === 0 ? "\n全部通过 ✓" : `\n${failed} 项失败 ✗`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error("脚本异常:", e.message);
  process.exit(1);
});
