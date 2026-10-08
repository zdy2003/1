"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BookOpenCheck, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download, FileCheck2, FileText, FolderKanban, Gavel, LayoutDashboard, Plus, Search, Settings, ShieldCheck, Sparkles, UploadCloud, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Finding = { id: string; level: "高风险" | "中风险" | "低风险"; category: "格式" | "内容"; title: string; detail: string; location: string; suggestion: string; evidence: string };
type ReviewResult = { score: number; summary: string; pageCount: number; findings: Finding[]; reviewedAreas: string[]; fileName: string; fileSize: number; hasTender: boolean; reviewedAt: string; durationSec: number };

declare global { interface Document { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

const nav = [[LayoutDashboard, "工作台"], [FolderKanban, "项目管理"], [FileCheck2, "审核记录"], [BookOpenCheck, "规则库"], [Users, "团队协作"]] as const;

function RiskBadge({ level }: { level: Finding["level"] }) {
  const styles = { 高风险: "bg-red-50 text-red-700", 中风险: "bg-amber-50 text-amber-700", 低风险: "bg-slate-100 text-slate-600" };
  return <span className={`risk-badge ${styles[level]}`}>{level}</span>;
}

function readableSize(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }

export default function Home() {
  const bidInputRef = useRef<HTMLInputElement>(null);
  const tenderInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("工作台");
  const [bidFile, setBidFile] = useState<File | null>(null);
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [resolved, setResolved] = useState<string[]>([]);
  const [error, setError] = useState("");

  const runReview = async () => {
    if (!bidFile) { setError("请先选择待审核标书"); return; }
    setAnalyzing(true); setError(""); setResolved([]);
    const started = performance.now();
    try {
      const form = new FormData();
      form.append("bidFile", bidFile);
      if (tenderFile) form.append("tenderFile", tenderFile);
      const response = await fetch("/api/review", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "审核失败");
      const result: ReviewResult = {
        ...data,
        durationSec: Math.max(1, Math.round((performance.now() - started) / 1000)),
        findings: data.findings.map((item: Omit<Finding, "level"> & { severity: Finding["level"] }) => ({ ...item, level: item.severity })),
      };
      setReview(result);
      setSelected(result.findings[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "审核失败，请稍后重试");
    } finally { setAnalyzing(false); }
  };

  const resetProject = () => { setBidFile(null); setTenderFile(null); setReview(null); setSelected(null); setError(""); setResolved([]); };
  const exportReport = () => {
    if (!review) return;
    const body = [`# ${review.fileName} 审核报告`, "", `- 综合得分：${review.score}`, `- 审核时间：${new Date(review.reviewedAt).toLocaleString("zh-CN")}`, `- 对照招标文件：${review.hasTender ? "是" : "否"}`, "", `## 审核结论`, "", review.summary, "", "## 问题清单", "", ...review.findings.flatMap((f, i) => [`### ${i + 1}. [${f.level}] ${f.title}`, "", `- 类型：${f.category}审核`, `- 位置：${f.location}`, `- 问题：${f.detail}`, `- 证据：${f.evidence}`, `- 建议：${f.suggestion}`, ""])].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${review.fileName}-审核报告.md`; link.click(); URL.revokeObjectURL(url);
  };

  const findings = review?.findings ?? [];
  const filtered = findings.filter((item) => `${item.title}${item.detail}${item.category}`.includes(query));
  const counts = { high: findings.filter((f) => f.level === "高风险").length, medium: findings.filter((f) => f.level === "中风险").length, low: findings.filter((f) => f.level === "低风险").length, format: findings.filter((f) => f.category === "格式").length, content: findings.filter((f) => f.category === "内容").length };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "get_bid_review_summary", title: "读取标书审核摘要", description: "读取当前页面已完成的标书审核评分和风险数量。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() { return review ? { fileName: review.fileName, score: review.score, summary: review.summary, findings: { total: review.findings.length, high: review.findings.filter((f) => f.level === "高风险").length, medium: review.findings.filter((f) => f.level === "中风险").length, low: review.findings.filter((f) => f.level === "低风险").length } } : { status: "no_completed_review" }; },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [review]);

  return <main className="min-h-screen bg-[#f3f7f8] text-[#172b32]">
    <header className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={24} strokeWidth={2.4} /></div><div><span>标衡</span><small>BIDWISE</small></div></div><div className="header-search"><Search size={17} /><input placeholder="搜索项目、标书或审核记录" aria-label="搜索" /><kbd>⌘ K</kbd></div><div className="header-actions"><button className="help-btn" aria-label="帮助"><CircleHelp size={19} /></button><span className="divider" /><button className="profile"><span>林</span><div><b>林知远</b><small>投标平台主管</small></div><ChevronDown size={15} /></button></div></header>
    <div className="app-shell">
      <aside className="sidebar"><nav>{nav.map(([Icon, label]) => <button key={label} onClick={() => setActiveNav(label)} className={activeNav === label ? "active" : ""}><Icon size={19} /><span>{label}</span></button>)}</nav><div className="quota real-service"><div className="quota-icon"><Sparkles size={18} /></div><div><b>AI 审核服务</b><span>格式 + 内容双重审核</span></div><div className="service-state"><i />服务端安全调用</div></div><button className="settings"><Settings size={18} /><span>系统设置</span></button></aside>
      <section className="workspace">
        <div className="page-heading"><div><p className="eyebrow">智能审核工作台</p><h1>标书智能审核</h1><p>上传投标文件，识别格式偏差、内容缺失和响应风险。</p></div><Button className="new-project" onClick={resetProject}><Plus size={17} />新建审核项目</Button></div>

        <section className="upload-panel upload-real">
          <div className="upload-copy"><div className="upload-icon"><UploadCloud size={25} /></div><div><h2>上传审核材料</h2><p>支持 DOC、DOCX、PDF，单个文件不超过 30MB</p></div></div>
          <div className="upload-actions">
            <input ref={bidInputRef} type="file" hidden accept=".doc,.docx,.pdf" onChange={(e) => { setBidFile(e.target.files?.[0] ?? null); setReview(null); setError(""); }} />
            <input ref={tenderInputRef} type="file" hidden accept=".doc,.docx,.pdf" onChange={(e) => { setTenderFile(e.target.files?.[0] ?? null); setReview(null); setError(""); }} />
            <Button variant="outline" onClick={() => bidInputRef.current?.click()}><FileText size={16} />{bidFile ? "更换标书" : "选择投标文件"}</Button>
            <Button variant="outline" onClick={() => tenderInputRef.current?.click()}><Gavel size={16} />{tenderFile ? "更换招标文件" : "添加招标文件（可选）"}</Button>
            <Button className="start-review" disabled={!bidFile || analyzing} onClick={runReview}><Sparkles size={16} />{analyzing ? "正在审核" : "开始审核"}</Button>
          </div>
          {(bidFile || tenderFile) && <div className="selected-files">{bidFile && <span><FileText size={14} /><b>投标文件</b>{bidFile.name}<small>{readableSize(bidFile.size)}</small><button onClick={() => { setBidFile(null); setReview(null); }}><X size={13} /></button></span>}{tenderFile && <span><Gavel size={14} /><b>招标文件</b>{tenderFile.name}<small>{readableSize(tenderFile.size)}</small><button onClick={() => { setTenderFile(null); setReview(null); }}><X size={13} /></button></span>}</div>}
        </section>
        {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}

        <div className="review-card">
          {analyzing ? <div className="analysis-state"><div className="scan-orbit"><ShieldCheck size={30} /></div><h3>正在进行真实双重审核</h3><p>{tenderFile ? "正在逐项比对招标要求、格式规范和标书响应…" : "正在检查格式规范、内容完整性和内部一致性…"}</p><Progress value={68} className="mt-5 h-2 w-72" /><small>复杂文件通常需要 1–3 分钟，请保持页面打开</small></div> : !review ? <div className="empty-review"><div><FileCheck2 size={34} /></div><h2>等待上传标书</h2><p>选择投标文件后开始审核。添加招标文件可获得逐条响应偏差检查。</p><div className="review-scope"><span><Check size={14} />字体与版式</span><span><Check size={14} />材料完整性</span><span><Check size={14} />参数与承诺</span><span><Check size={14} />前后一致性</span></div></div> : <>
            <div className="review-head"><div className="file-identity"><div className="doc-icon"><FileText size={22} /></div><div><h2>{review.fileName}</h2><p>{review.pageCount ? `${review.pageCount} 页 · ` : ""}{readableSize(review.fileSize)} · {review.hasTender ? "已对照招标文件" : "通用审核"}</p></div></div><div className="review-actions"><Button variant="outline" onClick={runReview}>重新审核</Button><Button className="export-btn" onClick={exportReport}><Download size={16} />导出报告</Button></div></div>
            <div className="score-strip"><div className="score-block"><div className="score-ring" style={{ background: `radial-gradient(circle at center,#fff 58%,transparent 60%),conic-gradient(#14817c 0 ${review.score}%,#dfeceb ${review.score}%)` }}><strong>{review.score}</strong><small>综合得分</small></div><div><b>{review.summary}</b><p>发现 {findings.length} 项需要关注的问题</p></div></div><div className="metric danger"><span><AlertTriangle size={17} /></span><div><small>高风险</small><strong>{counts.high}</strong></div></div><div className="metric warning"><span><CircleHelp size={17} /></span><div><small>中风险</small><strong>{counts.medium}</strong></div></div><div className="metric safe"><span><CheckCircle2 size={17} /></span><div><small>低风险</small><strong>{counts.low}</strong></div></div><div className="metric"><span><Clock3 size={17} /></span><div><small>审核耗时</small><strong>{review.durationSec}s</strong></div></div></div>
            {findings.length === 0 ? <div className="all-clear"><CheckCircle2 size={38} /><h3>未发现明确风险</h3><p>已完成 {review.reviewedAreas.join("、")} 检查，仍建议在提交前进行人工终审。</p></div> : <Tabs defaultValue="all" className="review-tabs"><div className="tabs-toolbar"><TabsList><TabsTrigger value="all">全部问题 <i>{findings.length}</i></TabsTrigger><TabsTrigger value="format">格式审核 <i>{counts.format}</i></TabsTrigger><TabsTrigger value="content">内容审核 <i>{counts.content}</i></TabsTrigger></TabsList><label className="issue-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选问题" /></label></div>
              {(["all", "format", "content"] as const).map((tab) => <TabsContent key={tab} value={tab} className="mt-0"><div className="issues-layout"><div className="issues-list">{filtered.filter((f) => tab === "all" || f.category === (tab === "format" ? "格式" : "内容")).map((item) => <button key={item.id} className={`issue-row ${selected?.id === item.id ? "selected" : ""} ${resolved.includes(item.id) ? "resolved" : ""}`} onClick={() => setSelected(item)}><span className={`severity-dot ${item.level === "高风险" ? "high" : item.level === "中风险" ? "medium" : "low"}`} /><div className="issue-main"><div><RiskBadge level={item.level} /><span className="category">{item.category}审核</span></div><h3>{item.title}</h3><p>{item.detail}</p><small><FileText size={13} />{item.location}</small></div>{resolved.includes(item.id) && <span className="resolved-mark"><Check size={15} />已处理</span>}</button>)}</div>{selected && <aside className="issue-detail"><div className="detail-top"><RiskBadge level={selected.level} /><span>{selected.category}审核</span></div><h3>{selected.title}</h3><div className="location-card"><FileText size={17} /><div><small>问题位置</small><b>{selected.location}</b></div></div><div className="quote-block"><span>审核证据</span><p>{selected.evidence}</p></div><div className="suggestion"><div><Sparkles size={17} /><b>修改建议</b></div><p>{selected.suggestion}</p></div><Button className="resolve-btn" onClick={() => setResolved((old) => old.includes(selected.id) ? old.filter((id) => id !== selected.id) : [...old, selected.id])}><Check size={17} />{resolved.includes(selected.id) ? "标记为未处理" : "标记为已处理"}</Button></aside>}</div></TabsContent>)}
            </Tabs>}
          </>}
        </div>
        <footer><span>审核引擎：服务端格式解析 + OpenAI 结构化内容审核</span><span>审核结果用于风险排查，投标前仍应由专业人员终审</span></footer>
      </section>
    </div>
  </main>;
}
