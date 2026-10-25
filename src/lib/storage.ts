import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfig } from "./config";
import { createLogger } from "./logger";
import type { FileRecord, ResultFile, TaskRecord } from "./types";

const log = createLogger("storage");

// ── 目录结构 ───────────────────────────────────────────────
// <dataDir>/uploads   原始上传文件
// <dataDir>/results   处理结果文件
// <dataDir>/meta      元数据 JSON（files.json / tasks.json / results.json）

function dataRoot(): string {
  const dir = getConfig().dataDir;
  // 支持绝对路径（测试用）与相对项目根目录的路径
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export const paths = {
  uploads: () => path.join(dataRoot(), "uploads"),
  results: () => path.join(dataRoot(), "results"),
  meta: () => path.join(dataRoot(), "meta"),
  uploadFile: (storedName: string) => path.join(paths.uploads(), storedName),
  resultFile: (storedName: string) => path.join(paths.results(), storedName),
  filesJson: () => path.join(paths.meta(), "files.json"),
  tasksJson: () => path.join(paths.meta(), "tasks.json"),
  resultsJson: () => path.join(paths.meta(), "results.json"),
};

async function ensureDirs(): Promise<void> {
  await Promise.all([
    fs.mkdir(paths.uploads(), { recursive: true }),
    fs.mkdir(paths.results(), { recursive: true }),
    fs.mkdir(paths.meta(), { recursive: true }),
  ]);
}

// ── 串行写队列：避免并发写同一 JSON 文件造成覆盖 ──────────

let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeChain.then(job, job);
  writeChain = run.catch(() => undefined);
  return run;
}

// ── JSON 集合存储（内存缓存 + 原子落盘） ──────────────────

interface Collection<T extends { id: string }> {
  items: T[];
}

async function readCollection<T extends { id: string }>(
  file: string,
): Promise<Collection<T>> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Collection<T>;
    if (Array.isArray(parsed?.items)) return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") log.warn("读取元数据失败", { file, err: String(err) });
  }
  return { items: [] };
}

async function writeCollection<T extends { id: string }>(
  file: string,
  data: Collection<T>,
): Promise<void> {
  await ensureDirs();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  // Windows 上 rename 不能覆盖已存在文件，先删再改名
  await fs.rm(file, { force: true });
  await fs.rename(tmp, file);
}

function makeStore<T extends { id: string }>(file: () => string, sortBy: (a: T, b: T) => number) {
  let cache: Collection<T> | null = null;
  let cacheDir: string | null = null;

  async function load(): Promise<Collection<T>> {
    // 数据目录变化时（如测试中切换 DATA_DIR）强制重新加载
    const dir = dataRoot();
    if (cacheDir !== dir) {
      cache = null;
      cacheDir = dir;
    }
    if (!cache) cache = await readCollection<T>(file());
    return cache;
  }

  return {
    async all(): Promise<T[]> {
      const data = await load();
      return [...data.items].sort(sortBy);
    },
    async get(id: string): Promise<T | null> {
      const data = await load();
      return data.items.find((x) => x.id === id) ?? null;
    },
    async insert(item: T): Promise<T> {
      return enqueue(async () => {
        const data = await load();
        data.items.push(item);
        await writeCollection(file(), data);
        return item;
      });
    },
    async update(id: string, patch: Partial<T>): Promise<T | null> {
      return enqueue(async () => {
        const data = await load();
        const idx = data.items.findIndex((x) => x.id === id);
        if (idx === -1) return null;
        data.items[idx] = { ...data.items[idx], ...patch };
        await writeCollection(file(), data);
        return data.items[idx];
      });
    },
    async remove(id: string): Promise<T | null> {
      return enqueue(async () => {
        const data = await load();
        const idx = data.items.findIndex((x) => x.id === id);
        if (idx === -1) return null;
        const [removed] = data.items.splice(idx, 1);
        await writeCollection(file(), data);
        return removed;
      });
    },
    async removeAll(): Promise<void> {
      await enqueue(async () => {
        cache = { items: [] };
        await writeCollection(file(), cache);
      });
    },
  };
}

const byNewest = (a: { uploadedAt?: string; createdAt?: string }, b: { uploadedAt?: string; createdAt?: string }) =>
  (b.uploadedAt ?? b.createdAt ?? "").localeCompare(a.uploadedAt ?? a.createdAt ?? "");

export const fileStore = makeStore<FileRecord>(paths.filesJson, byNewest);
export const taskStore = makeStore<TaskRecord>(paths.tasksJson, byNewest);
export const resultStore = makeStore<ResultFile>(paths.resultsJson, byNewest);

// ── 文件 blob 读写 ─────────────────────────────────────────

export async function writeUpload(storedName: string, data: Buffer): Promise<void> {
  await ensureDirs();
  await fs.writeFile(paths.uploadFile(storedName), data);
}

export async function readUpload(storedName: string): Promise<Buffer> {
  return fs.readFile(paths.uploadFile(storedName));
}

export async function writeResult(storedName: string, data: Buffer): Promise<void> {
  await ensureDirs();
  await fs.writeFile(paths.resultFile(storedName), data);
}

export async function readResult(storedName: string): Promise<Buffer> {
  return fs.readFile(paths.resultFile(storedName));
}

export async function removeUploadBlob(storedName: string): Promise<void> {
  await fs.rm(paths.uploadFile(storedName), { force: true });
}

export async function removeResultBlob(storedName: string): Promise<void> {
  await fs.rm(paths.resultFile(storedName), { force: true });
}

/** 删除任务及其全部结果文件 */
export async function deleteTaskCascade(taskId: string): Promise<TaskRecord | null> {
  const task = await taskStore.get(taskId);
  if (!task) return null;
  const results = await resultStore.all();
  for (const r of results.filter((x) => x.taskId === taskId)) {
    await removeResultBlob(r.storedName);
    await resultStore.remove(r.id);
  }
  await taskStore.remove(taskId);
  return task;
}

/** 清空全部数据（设置页“危险区”），随后重建目录 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    fileStore.removeAll(),
    taskStore.removeAll(),
    resultStore.removeAll(),
  ]);
  await fs.rm(paths.uploads(), { recursive: true, force: true });
  await fs.rm(paths.results(), { recursive: true, force: true });
  await ensureDirs();
  log.info("已清空全部数据");
}

export async function storageStats(): Promise<{
  fileCount: number;
  taskCount: number;
  resultCount: number;
}> {
  const [files, tasks, results] = await Promise.all([
    fileStore.all(),
    taskStore.all(),
    resultStore.all(),
  ]);
  return {
    fileCount: files.length,
    taskCount: tasks.length,
    resultCount: results.length,
  };
}
