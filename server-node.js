import express from "express";
import multer from "multer";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { mkdirSync, appendFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { unzipSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.DOCGUARD_UPLOAD_WRITE_ROOT || join(__dirname, "docguard-inbox");
const RESULT_DIR = process.env.DOCGUARD_RESULT_WRITE_ROOT || join(__dirname, "docguard-results");
const LOG_FILE = process.env.DOCGUARD_LOG_FILE || join(__dirname, "logs", "docguard.log");
const LOG_DIR = dirname(LOG_FILE);
const DB_PATH = join(__dirname, "data", "docguard.db");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

// Ensure directories exist
function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDir(LOG_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(RESULT_DIR);
ensureDir(join(__dirname, "data"));

// Logger
function log(level, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? " " + JSON.stringify(data) : "";
  const line = `[${timestamp}] [${level}] ${message}${dataStr}`;
  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch (e) {
    console.error("Failed to write log:", e);
  }
  console.log(line);
}

// Database init
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    file_name TEXT NOT NULL,
    tender_file_name TEXT,
    file_key TEXT NOT NULL,
    tender_file_key TEXT,
    status TEXT DEFAULT 'running' NOT NULL,
    score INTEGER,
    high_count INTEGER DEFAULT 0 NOT NULL,
    medium_count INTEGER DEFAULT 0 NOT NULL,
    low_count INTEGER DEFAULT 0 NOT NULL,
    summary TEXT,
    result_json TEXT,
    error TEXT,
    response_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER
  );
`);

const app = express();
app.use(express.json());

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function extensionOf(filename) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function validateFile(file, label) {
  const ext = extensionOf(file.originalname || file.filename);
  if (ext === "doc") throw new Error(`${label}不支持旧版 DOC`);
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`${label}仅支持 PDF、DOCX、TXT、MD`);
  if (file.size > MAX_FILE_SIZE) throw new Error(`${label}不能超过 5MB`);
}

function extractDocxText(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const documentXml = files["word/document.xml"];
  if (!documentXml) throw new Error("DOCX 文件缺少 word/document.xml，文件可能已损坏");
  return new TextDecoder()
    .decode(documentXml)
    .replace(/<w:tab\/?\s*>/g, "\t")
    .replace(/<w:br\/?\s*>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function filePart(file) {
  const ext = extensionOf(file.originalname);
  if (ext === "docx") {
    const text = extractDocxText(file.buffer);
    return { type: "input_file", source: { type: "base64", media_type: "text/plain", data: Buffer.from(text, "utf8").toString("base64"), filename: `${file.originalname}.txt` } };
  }
  const mediaType = ext === "pdf" ? "application/pdf" : ext === "md" ? "text/markdown" : "text/plain";
  return { type: "input_file", source: { type: "base64", media_type: mediaType, data: file.buffer.toString("base64"), filename: file.originalname } };
}

function saveResult(fileName, data) {
  const filePath = join(RESULT_DIR, fileName);
  writeFileSync(filePath, data, "utf-8");
  return filePath;
}

function parseJsonResult(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("OpenClaw 未返回可解析的 JSON: " + clean.slice(0, 200));
  }
}

function extractOpenClawText(data) {
  if (data.output_text) return data.output_text;
  return data.output?.flatMap(item => item.content ?? [])
    .filter(part => part.type === "output_text" || part.type === "text")
    .map(part => part.text ?? "").join("\n") ?? "";
}

app.post("/api/review", upload.fields([{ name: "bidFile", maxCount: 1 }, { name: "tenderFile", maxCount: 1 }]), async (req, res) => {
  const started = Date.now();
  const requestId = randomUUID();
  let reviewId = "";
  let bidPath = null;
  let tenderPath = null;
  log("INFO", "Review request started", { requestId });

  try {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const apiToken = process.env.OPENCLAW_API_TOKEN;
    const agentId = process.env.OPENCLAW_AGENT_ID || "default";

    log("INFO", "Environment check", { gatewayUrl, hasToken: !!apiToken, agentId });

    if (!gatewayUrl || !apiToken) {
      return res.status(503).json({ error: "请配置 OPENCLAW_GATEWAY_URL 和 OPENCLAW_API_TOKEN" });
    }

    const baseUrl = gatewayUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    log("INFO", "OpenClaw base URL", { baseUrl });

    const bidFile = req.files?.bidFile?.[0];
    const tenderFile = req.files?.tenderFile?.[0];

    if (!bidFile) return res.status(400).json({ error: "请上传待审核标书" });
    validateFile(bidFile, "标书文件");
    if (tenderFile) validateFile(tenderFile, "招标文件");

    log("INFO", "Files validated", { bidFile: bidFile.originalname, size: bidFile.size, tenderFile: tenderFile?.originalname });

    reviewId = randomUUID();
    const bidKey = `reviews/${reviewId}/bid-${bidFile.originalname}`;
    bidPath = join(UPLOAD_DIR, bidKey.replace(/\//g, "_"));
    writeFileSync(bidPath, bidFile.buffer);
    log("INFO", "Bid file saved", { bidKey, path: bidPath });

    let tenderKey = null;
    if (tenderFile) {
      tenderKey = `reviews/${reviewId}/tender-${tenderFile.originalname}`;
      tenderPath = join(UPLOAD_DIR, tenderKey.replace(/\//g, "_"));
      writeFileSync(tenderPath, tenderFile.buffer);
      log("INFO", "Tender file saved", { tenderKey, path: tenderPath });
    }

    db.prepare(
      `INSERT INTO reviews (id,file_name,tender_file_name,file_key,tender_file_key,status,created_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run(reviewId, bidFile.originalname, tenderFile?.originalname || null, bidKey, tenderKey, "running", new Date(started).toISOString());
    log("INFO", "Review record created in DB", { reviewId });

    const prompt = `请调用 $bid-document-audit 技能审核投标文件"${bidFile.originalname}"。${
      tenderFile ? "已附招标文件，必须逐项核对实质性要求。" : "未附招标文件，只能检查通用规范，不得虚构招标方要求。"
    }
必须只输出一个 JSON 对象，不要使用 Markdown 代码块。结构如下：
{"score":0到100,"summary":"结论","pageCount":0,"reviewedAreas":["领域"],"findings":[{"id":"编号","severity":"高风险|中风险|低风险","category":"格式|内容","title":"标题","detail":"详情","location":"位置","suggestion":"建议","evidence":"证据"}]}`;

    const content = [
      { type: "input_text", text: prompt },
      filePart(bidFile),
    ];
    if (tenderFile) content.push(filePart(tenderFile));

    const input = [{ type: "message", role: "user", content }];
    const headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
    if (agentId !== "default") headers["x-openclaw-agent-id"] = agentId;

    log("INFO", "Calling OpenClaw agent", { requestId, reviewId, gatewayOrigin: new URL(baseUrl).origin, agentId, model: `openclaw/${agentId}`, inputType: input[0].type, contentTypes: content.map((part) => part.type), fileCount: content.filter((part) => part.type === "input_file").length });

    const response = await fetch(`${baseUrl}/v1/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: `openclaw/${agentId}`,
        user: `bidwise:standalone`,
        stream: false,
        input,
        max_output_tokens: 12000,
      }),
    });

    log("INFO", "OpenClaw response status", { status: response.status, ok: response.ok });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      log("ERROR", "Failed to parse OpenClaw response as JSON", { error: e.message });
      throw new Error("OpenClaw 返回格式错误: " + responseText.slice(0, 200));
    }

    if (!response.ok) {
      log("ERROR", "OpenClaw API error", { error: data.error, status: response.status });
      throw new Error(data.error?.message || `OpenClaw 失败（HTTP ${response.status}）`);
    }

    const text = extractOpenClawText(data);
    log("INFO", "OpenClaw response received", { requestId, reviewId, responseId: data.id || null, textLength: text.length });

    if (!text) {
      log("ERROR", "No text in OpenClaw response");
      throw new Error("OpenClaw 未返回审核结果文本");
    }

    const result = parseJsonResult(text);
    log("INFO", "Review result parsed", { requestId, reviewId, score: result.score, findingCount: result.findings?.length || 0 });

    const counts = {
      high: result.findings?.filter(f => f.severity === "高风险").length || 0,
      medium: result.findings?.filter(f => f.severity === "中风险").length || 0,
      low: result.findings?.filter(f => f.severity === "低风险").length || 0,
    };

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - started;

    db.prepare(
      `UPDATE reviews SET status='completed',score=?,high_count=?,medium_count=?,low_count=?,
       summary=?,result_json=?,response_id=?,completed_at=?,duration_ms=? WHERE id=?`
    ).run(result.score, counts.high, counts.medium, counts.low, result.summary, JSON.stringify(result), data.id || null, completedAt, durationMs, reviewId);

    const resultPath = saveResult(`review-${reviewId}.json`, JSON.stringify(result, null, 2));
    log("INFO", "Review result saved", { reviewId, score: result.score, resultPath });

    log("INFO", "Review completed successfully", { requestId, reviewId, durationMs });

    res.json({
      ...result,
      reviewId,
      fileName: bidFile.originalname,
      fileSize: bidFile.size,
      hasTender: Boolean(tenderFile),
      reviewedAt: completedAt,
      durationSec: Math.max(1, Math.round(durationMs / 1000)),
    });
  } catch (error) {
    const message = error.message || "审核失败";
    log("ERROR", "Review failed", { requestId, error: message, stack: error.stack, reviewId });
    if (reviewId) {
      db.prepare("UPDATE reviews SET status='failed',error=?,completed_at=?,duration_ms=? WHERE id=?")
        .run(message, new Date().toISOString(), Date.now() - started, reviewId);
    }
    res.status(500).json({ error: message, requestId });
  } finally {
    try { if (bidPath) unlinkSync(bidPath); } catch (e) { log("WARN", "Failed to delete bid file", { requestId, error: e.message }); }
    try { if (tenderPath) unlinkSync(tenderPath); } catch (e) { log("WARN", "Failed to delete tender file", { requestId, error: e.message }); }
  }
});

app.listen(PORT, () => {
  log("INFO", "========================================");
  log("INFO", `Node.js API server running on port ${PORT}`);
  log("INFO", `Upload directory: ${UPLOAD_DIR}`);
  log("INFO", `Result directory: ${RESULT_DIR}`);
  log("INFO", `Log file: ${LOG_FILE}`);
  log("INFO", `Database: ${DB_PATH}`);
  log("INFO", "========================================");
});
