# 贡献指南

感谢你对 AnythingBox 的关注！本文档说明如何搭建开发环境、运行测试以及提交变更。

## 开发环境

- Node.js ≥ 20（推荐 LTS）
- npm ≥ 10
- Git

```bash
git clone <你的仓库地址>
cd anythingbox
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

打开 <http://localhost:3000>。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（Turbopack） |
| `npm run build` | 生产构建 |
| `npm run start` | 运行生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 运行单元测试（Vitest） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试（需先 `npm run build && npm run start`） |

## 目录结构

```
src/
  app/            Next.js App Router：页面与 API 路由
    api/          files / process / tasks / results / download / config / health
  components/     页面组件与 ui/（shadcn/ui 基础组件）
  lib/            核心库：storage、extract、convert、ocr、ai、engine、config
tests/            Vitest 单元与集成测试
e2e/              Playwright 端到端测试
```

## 提交规范

- 提交信息使用简洁的英文或中文祈使句，例如 `fix: 结果文件未关联任务 id`。
- 一个提交聚焦一件事；大改动请拆分。
- 新功能必须附带测试；修复 bug 时优先写一个能复现问题的测试。

## 代码要求

- TypeScript 严格模式必须通过（`npm run typecheck`）。
- ESLint 无错误（警告也应尽量清理）。
- 所有测试通过（`npm test`）。
- 不要提交 `.env`、`.data/`、密钥或任何个人信息。

## 报告问题

提交 issue 时请附上：复现步骤、期望行为、实际行为、相关日志（注意脱敏）与环境信息。
