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

## 本地开发

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run build
npm start
```

本地预览使用 Cloudflare D1 和 R2 模拟绑定。首次启动前，按生成的迁移文件将数据库迁移应用到本地 D1。

## 文件限制

默认接受 PDF、DOCX、TXT、Markdown，单个文件不超过 5MB。旧版 DOC 需先转换为 DOCX 或 PDF。若 OpenClaw 网关调整了 `gateway.http.endpoints.responses.files.maxBytes`，可同步修改平台的上传限制。
