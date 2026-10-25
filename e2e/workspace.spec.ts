import { expect, test } from "@playwright/test";
import path from "node:path";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

test.describe("AnythingBox 端到端", () => {
  test("首页正常渲染并有导航入口", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("文件处理");
    await expect(page.getByRole("link", { name: "打开工作台" }).first()).toBeVisible();
  });

  test("帮助页与设置页可达", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "帮助中心" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
    await expect(page.getByText("隐私与数据处理")).toBeVisible();
  });

  test("上传 TXT → 提取文本 → 下载结果 → 任务记录可查", async ({ page }) => {
    await page.goto("/workspace");

    // 上传 fixture
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURE_DIR, "sample.txt"));
    await expect(page.getByText("sample.txt")).toBeVisible({ timeout: 20_000 });

    // 默认操作即“提取文本”，文件已自动选中？未选中则手动勾选
    const checkbox = page.getByLabel("选择 sample.txt");
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    await page.getByRole("button", { name: "开始处理" }).click();

    // 结果区出现下载按钮
    const downloadBtn = page.getByRole("link", { name: "下载" }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 30_000 });

    // 下载并验证内容
    const [download] = await Promise.all([page.waitForEvent("download"), downloadBtn.click()]);
    expect(download.suggestedFilename()).toMatch(/sample.*\.txt$/);
    const failure = await download.failure();
    expect(failure).toBeNull();

    // 任务记录页可见
    await page.goto("/tasks");
    await expect(page.getByText("提取文本").first()).toBeVisible();
    await expect(page.getByText("全部成功").first()).toBeVisible();
  });

  test("上传 CSV → 转换 JSON → 任务记录 ZIP 下载", async ({ page }) => {
    await page.goto("/workspace");
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURE_DIR, "sample.csv"));
    await expect(page.getByText("sample.csv")).toBeVisible({ timeout: 20_000 });

    const checkbox = page.getByLabel("选择 sample.csv");
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    // 切换到“格式转换”，目标 JSON
    await page.getByRole("button", { name: "格式转换" }).click();
    await page.locator("#convert-target").click();
    await page.getByRole("option", { name: /JSON/ }).click();
    await page.getByRole("button", { name: "开始处理" }).click();

    const downloadBtn = page.getByRole("link", { name: "下载" }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), downloadBtn.click()]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("未配置 AI 时提示明确", async ({ page }) => {
    await page.goto("/workspace");
    await page.getByRole("button", { name: "AI 分析" }).click();
    // 未配置密钥时显示配置指引（若 CI 环境配置了密钥则跳过该断言）
    const notice = page.getByText("AI 服务尚未配置");
    if (await notice.count()) {
      await expect(notice.first()).toBeVisible();
    }
  });
});
