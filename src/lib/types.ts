/** 文件类别，由扩展名推断 */
export type FileKind =
  | "text"
  | "markdown"
  | "csv"
  | "json"
  | "html"
  | "pdf"
  | "docx"
  | "image";

/** 可作为转换目标的格式 */
export type TargetFormat = "txt" | "md" | "html" | "docx" | "pdf" | "json" | "csv";

export interface FileRecord {
  id: string;
  /** 用户上传时的原始文件名（已消毒） */
  originalName: string;
  /** 存储在磁盘上的文件名（id + 扩展名） */
  storedName: string;
  /** 小写、不带点，例如 "pdf" */
  extension: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type TaskStatus = "completed" | "partial" | "failed";

export interface TaskInputRef {
  id: string;
  name: string;
}

export interface TaskError {
  fileId?: string;
  name: string;
  error: string;
}

export interface AiOutput {
  fileId: string;
  name: string;
  output: string;
}

export interface TaskRecord {
  id: string;
  /** 规范化操作 id，例如 "convert:pdf"、"ai:summarize" */
  op: string;
  opLabel: string;
  inputFiles: TaskInputRef[];
  status: TaskStatus;
  createdAt: string;
  finishedAt: string;
  durationMs: number;
  resultIds: string[];
  aiOutputs?: AiOutput[];
  errors?: TaskError[];
  detail: string;
}

export interface ResultFile {
  id: string;
  taskId: string;
  sourceFileId: string;
  name: string;
  mimeType: string;
  size: number;
  storedName: string;
  createdAt: string;
}
