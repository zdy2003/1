# 标衡 · 标书审核平台

面向投标团队的 OpenClaw 标书审核平台。支持真实文件上传、项目归档、审核记录、企业规则库、团队成员管理和 OpenClaw 网关配置。

## OpenClaw 准备

1. 将 `skills/bid-document-audit` 复制到 OpenClaw 的技能目录。
2. 为 Gateway 配置可从公网访问的 HTTPS 地址。
3. 启用 OpenResponses 接口：

```json5
{
  gateway: {
    uploads: { enabled: true },
    http: {
      endpoints: {
        responses: { enabled: true }
      }
    }
  }
}
```

4. 在平台“系统设置”中填写 Gateway 地址、Bearer Token 和 Agent ID，然后保存并测试。

平台通过服务端调用 `POST /v1/responses`。Token 使用 `APP_ENCRYPTION_KEY` 进行 AES-GCM 加密，并写入 HttpOnly Cookie，不会发送到前端脚本。

也可以通过不提交的 `.env.local` 或托管平台环境变量配置 `OPENCLAW_GATEWAY_URL`、`OPENCLAW_API_TOKEN` 和 `OPENCLAW_AGENT_ID`。Gateway 地址既可以写根地址，也可以带 `/v1`，平台会自动规范化。

## 本地开发

### Node.js 审核接口

将 `.env.example` 复制为 `.env.local`，填写 OpenClaw Gateway 和 Token 后启动：

```bash
cp .env.example .env.local
npm install
npm run start:node
```

`start:node` 会自动读取 `.env.local`，默认在 `http://127.0.0.1:3001` 提供 `POST /api/review`。无需再手动导出环境变量。

### Cloudflare 本地预览

```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
npm install
npm run db:generate
npm run build
npm start
```

本地预览使用 Cloudflare D1 和 R2 模拟绑定。`.env.local` 供框架开发模式读取，`.dev.vars` 供构建后的 Wrangler Worker 读取，两者都已被 Git 忽略。首次启动前，按生成的迁移文件将数据库迁移应用到本地 D1。

## 文件限制

默认接受 PDF、DOCX、TXT、Markdown，单个文件不超过 5MB。旧版 DOC 需先转换为 DOCX 或 PDF。若 OpenClaw 网关调整了 `gateway.http.endpoints.responses.files.maxBytes`，可同步修改平台的上传限制。

## 运行日志与排错

Node.js 服务的启动信息、请求状态和审核诊断会同时追加到：

```text
logs/docguard.log
```

Cloudflare 本地预览使用：

```text
logs/runtime-YYYY-MM-DD.log
```

审核日志使用同一个 `requestId` 和 `reviewId` 串联以下阶段：

- `upload_validated`：文件类型和大小校验通过
- `upload_persisted`：文件与审核任务已保存
- `openclaw_request`：已向 OpenClaw 发送请求，并记录输入块类型
- `openclaw_error`：网关拒绝请求
- `output_parse_failed` / `output_repaired`：模型 JSON 输出解析失败及自动修复
- `review_completed` / `review_failed`：任务最终状态

日志不会记录 OpenClaw Token、上传文件正文或完整模型输出。遇到接口错误时，可用响应中的 `requestId` 在 `logs/docguard.log` 中定位同一次审核请求。
