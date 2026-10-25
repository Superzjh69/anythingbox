import Papa from "papaparse";

export interface PreviewTable {
  fields: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/** 解析 CSV 并返回前 limit 行的预览表格（容忍解析错误，尽量返回可用数据） */
export function csvPreview(csv: string, limit = 15): { table: PreviewTable | null; text: string } {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = result.meta.fields ?? [];
  if (fields.length === 0 || result.data.length === 0) {
    return { table: null, text: csv.slice(0, 2000) };
  }
  return {
    table: {
      fields,
      rows: result.data.slice(0, limit),
      totalRows: result.data.length,
    },
    text: csv.slice(0, 2000),
  };
}
