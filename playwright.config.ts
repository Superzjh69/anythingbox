import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "edge",
      // 使用系统自带 Edge，避免下载浏览器
      use: { ...devices["Desktop Chrome"], channel: "msedge" },
    },
  ],
  // 若服务未启动则由测试前的全局脚手架负责；此处不自动启动，方便手动调试
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
