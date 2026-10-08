"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BookOpenCheck, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download, FileCheck2, FileText, FolderKanban, LayoutDashboard, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, UploadCloud, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Finding = { id: number; level: "高风险" | "中风险" | "低风险"; category: "格式" | "内容"; title: string; detail: string; location: string; suggestion: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const findings: Finding[] = [
  { id: 1, level: "高风险", category: "内容", title: "交付周期与招标要求不一致", detail: "投标文件承诺交付周期为 90 个自然日，招标文件要求不超过 75 个自然日。", location: "第 42 页 · 6.2 项目实施计划", suggestion: "将交付周期调整为 75 个自然日以内，并同步更新甘特图和里程碑计划。" },
  { id: 2, level: "高风险", category: "内容", title: "关键人员证书材料缺失", detail: "项目经理履历中提及信息系统项目管理师证书，但附件未发现证书扫描件。", location: "第 68 页 · 8.1 项目团队", suggestion: "补充项目经理有效证书扫描件，并检查姓名、证书编号和有效期。" },
  { id: 3, level: "中风险", category: "格式", title: "正文出现非规定字体", detail: "第 27 页正文使用微软雅黑，未按要求统一为小四号宋体。", location: "第 27 页 · 4.3 技术方案", suggestion: "将该段字体统一为小四号宋体，行距设为 1.5 倍。" },
  { id: 4, level: "中风险", category: "内容", title: "技术参数响应表述不完整", detail: "对并发用户数要求仅填写“满足”，未提供具体响应值和证明材料索引。", location: "第 35 页 · 技术偏离表第 12 项", suggestion: "补充具体并发指标，并引用性能测试报告所在页码。" },
  { id: 5, level: "低风险", category: "格式", title: "目录页码未同步更新", detail: "“售后服务方案”目录页码为 86，实际内容从第 88 页开始。", location: "第 3 页 · 目录", suggestion: "更新全文目录域并复核所有一级、二级标题页码。" },
];

const nav = [[LayoutDashboard, "工作台"], [FolderKanban, "项目管理"], [FileCheck2, "审核记录"], [BookOpenCheck, "规则库"], [Users, "团队协作"]] as const;

function RiskBadge({ level }: { level: Finding["level"] }) {
  const styles = { 高风险: "bg-red-50 text-red-700", 中风险: "bg-amber-50 text-amber-700", 低风险: "bg-slate-100 text-slate-600" };
  return <span className={`risk-badge ${styles[level]}`}>{level}</span>;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("工作台");
  const [fileName, setFileName] = useState("智慧园区综合管理平台建设项目投标文件.docx");
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState<Finding>(findings[0]);
  const [resolved, setResolved] = useState<number[]>([]);
  const runReview = (name?: string) => { if (name) setFileName(name); setAnalyzing(true); setTimeout(() => setAnalyzing(false), 1600); };
  const filtered = findings.filter((item) => `${item.title}${item.detail}${item.category}`.includes(query));

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "start_bid_review",
      title: "开始标书审核",
      description: "为指定文件开始格式与内容双重审核，并在工作台显示审核状态。",
      inputSchema: { type: "object", properties: { fileName: { type: "string", minLength: 1 } }, required: ["fileName"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const value = input as { fileName?: unknown };
        if (typeof value.fileName !== "string" || !value.fileName.trim()) throw new Error("fileName 必须是非空字符串");
        runReview(value.fileName.trim());
        return { status: "review_started", fileName: value.fileName.trim(), reviewTypes: ["format", "content"] };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="min-h-screen bg-[#f3f7f8] text-[#172b32]">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={24} strokeWidth={2.4} /></div><div><span>标衡</span><small>BIDWISE</small></div></div>
        <div className="header-search"><Search size={17} /><input placeholder="搜索项目、标书或审核记录" aria-label="搜索" /><kbd>⌘ K</kbd></div>
        <div className="header-actions"><button className="help-btn" aria-label="帮助"><CircleHelp size={19} /></button><span className="divider" /><button className="profile"><span>林</span><div><b>林知远</b><small>投标平台主管</small></div><ChevronDown size={15} /></button></div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <nav>{nav.map(([Icon, label]) => <button key={label} onClick={() => setActiveNav(label)} className={activeNav === label ? "active" : ""}><Icon size={19} /><span>{label}</span>{label === "审核记录" && <em>12</em>}</button>)}</nav>
          <div className="quota"><div className="quota-icon"><Sparkles size={18} /></div><div><b>本月审核额度</b><span>已使用 18 / 30 份</span></div><Progress value={60} className="h-1.5" /><button>查看使用明细</button></div>
          <button className="settings"><Settings size={18} /><span>系统设置</span></button>
        </aside>

        <section className="workspace">
          <div className="page-heading"><div><p className="eyebrow">今日工作台</p><h1>标书智能审核</h1><p>识别格式偏差与内容风险，让每一次投标更稳妥。</p></div><Button className="new-project"><Plus size={17} />新建审核项目</Button></div>
          <section className="upload-panel"><div className="upload-copy"><div className="upload-icon"><UploadCloud size={25} /></div><div><h2>上传待审核标书</h2><p>支持 DOC、DOCX、PDF，单个文件不超过 100MB</p></div></div><input ref={inputRef} type="file" hidden accept=".doc,.docx,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) runReview(file.name); }} /><Button variant="outline" onClick={() => inputRef.current?.click()}><UploadCloud size={17} />选择文件</Button></section>

          <div className="review-card">
            <div className="review-head"><div className="file-identity"><div className="doc-icon"><FileText size={22} /></div><div><h2>{fileName}</h2><p>126 页 · 24.6 MB · 最后审核于今天 14:32</p></div></div><div className="review-actions"><Button variant="outline" onClick={() => runReview()}>{analyzing ? "正在重新审核…" : "重新审核"}</Button><Button className="export-btn"><Download size={16} />导出报告</Button><button className="more-btn"><MoreHorizontal size={19} /></button></div></div>

            {analyzing ? <div className="analysis-state"><div className="scan-orbit"><ShieldCheck size={30} /></div><h3>正在进行双重审核</h3><p>正在比对格式规范、招标要求和内容完整性…</p><Progress value={68} className="mt-5 h-2 w-72" /></div> : <>
              <div className="score-strip"><div className="score-block"><div className="score-ring"><strong>86</strong><small>综合得分</small></div><div><b>整体质量良好</b><p>发现 5 项需要关注的问题</p></div></div><div className="metric danger"><span><AlertTriangle size={17} /></span><div><small>高风险</small><strong>2</strong></div></div><div className="metric warning"><span><CircleHelp size={17} /></span><div><small>中风险</small><strong>2</strong></div></div><div className="metric safe"><span><CheckCircle2 size={17} /></span><div><small>低风险</small><strong>1</strong></div></div><div className="metric"><span><Clock3 size={17} /></span><div><small>审核耗时</small><strong>3m 26s</strong></div></div></div>
              <Tabs defaultValue="all" className="review-tabs">
                <div className="tabs-toolbar"><TabsList><TabsTrigger value="all">全部问题 <i>5</i></TabsTrigger><TabsTrigger value="format">格式审核 <i>2</i></TabsTrigger><TabsTrigger value="content">内容审核 <i>3</i></TabsTrigger></TabsList><label className="issue-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选问题" /></label></div>
                {(["all", "format", "content"] as const).map((tab) => <TabsContent key={tab} value={tab} className="mt-0"><div className="issues-layout"><div className="issues-list">{filtered.filter((f) => tab === "all" || f.category === (tab === "format" ? "格式" : "内容")).map((item) => <button key={item.id} className={`issue-row ${selected.id === item.id ? "selected" : ""} ${resolved.includes(item.id) ? "resolved" : ""}`} onClick={() => setSelected(item)}><span className={`severity-dot ${item.level === "高风险" ? "high" : item.level === "中风险" ? "medium" : "low"}`} /><div className="issue-main"><div><RiskBadge level={item.level} /><span className="category">{item.category}审核</span></div><h3>{item.title}</h3><p>{item.detail}</p><small><FileText size={13} />{item.location}</small></div>{resolved.includes(item.id) && <span className="resolved-mark"><Check size={15} />已处理</span>}</button>)}</div><aside className="issue-detail"><div className="detail-top"><RiskBadge level={selected.level} /><span>{selected.category}审核</span></div><h3>{selected.title}</h3><div className="location-card"><FileText size={17} /><div><small>问题位置</small><b>{selected.location}</b></div></div><div className="quote-block"><span>原文</span><p>{selected.detail}</p></div><div className="suggestion"><div><Sparkles size={17} /><b>修改建议</b></div><p>{selected.suggestion}</p></div><Button className="resolve-btn" onClick={() => setResolved((old) => old.includes(selected.id) ? old.filter((id) => id !== selected.id) : [...old, selected.id])}><Check size={17} />{resolved.includes(selected.id) ? "标记为未处理" : "标记为已处理"}</Button></aside></div></TabsContent>)}
              </Tabs>
            </>}
          </div>
          <footer><span>审核规则库版本：企业招投标通用规则 v3.2</span><span>结果仅供辅助判断，最终内容请由专业人员复核</span></footer>
        </section>
      </div>
    </main>
  );
}
