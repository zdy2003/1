import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs";

const UPLOAD_DIR = process.env.DOCGUARD_UPLOAD_WRITE_ROOT || join(process.cwd(), "docguard-inbox");
const RESULT_DIR = process.env.DOCGUARD_RESULT_WRITE_ROOT || join(process.cwd(), "docguard-results");

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveFile(key: string, data: ArrayBuffer): void {
  ensureDir(UPLOAD_DIR);
  const filePath = join(UPLOAD_DIR, key.replace(/\//g, "_"));
  writeFileSync(filePath, Buffer.from(data));
}

export function readFile(key: string): Buffer | null {
  try {
    const filePath = join(UPLOAD_DIR, key.replace(/\//g, "_"));
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

export function deleteFile(key: string): void {
  try {
    const filePath = join(UPLOAD_DIR, key.replace(/\//g, "_"));
    unlinkSync(filePath);
  } catch { /* ignore */ }
}

export function saveResult(fileName: string, data: string): string {
  ensureDir(RESULT_DIR);
  const filePath = join(RESULT_DIR, fileName);
  writeFileSync(filePath, data, "utf-8");
  return filePath;
}
