import type { Metadata } from "next";
import { TasksClient } from "@/components/tasks/tasks-client";

export const metadata: Metadata = {
  title: "任务记录",
};

export default function TasksPage() {
  return <TasksClient />;
}
