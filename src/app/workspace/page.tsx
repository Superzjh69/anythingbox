import type { Metadata } from "next";
import { WorkspaceClient } from "@/components/workspace/workspace-client";

export const metadata: Metadata = {
  title: "文件工作台",
};

export default function WorkspacePage() {
  return <WorkspaceClient />;
}
