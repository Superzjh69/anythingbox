import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata: Metadata = {
  title: "设置",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
