"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, CircleHelp, Download, FileCheck2, FileText, FolderKanban, Gavel, LayoutDashboard, Plus, Search, Settings, ShieldCheck, Sparkles, Trash2, UploadCloud, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

type Finding = { id:string; level:"高风险"|"中风险"|"低风险"; severity?:"高风险"|"中风险"|"低风险"; category:"格式"|"内容"; title:string; detail:string; location:string; suggestion:string; evidence:string };
type ReviewResult = { reviewId?:string; score:number; summary:string; pageCount:number; findings:Finding[]; reviewedAreas:string[]; fileName:string; fileSize:number; hasTender:boolean; reviewedAt:string; durationSec:number };
type Project = { id:string; name:string; client:string; status:string; dueDate?:string; reviewCount:number };
type ReviewRow = { id:string; fileName:string; tenderFileName?:string; status:string; score?:number; highCount:number; mediumCount:number; lowCount:number; summary?:string; error?:string; createdAt:string; durationMs?:number; projectName?:string };
type Rule = { id:string; name:string; category:string; severity:string; description:string; enabled:boolean|number };
type Member = { id:string; name:string; email:string; role:string; status:string };
type SettingsState = { connected:boolean; baseUrl?:string; agentId?:string };
type ReviewDetail = { file_name:string; tender_file_name?:string; projectName?:string; created_at:string; completed_at:string; duration_ms?:number; high_count:number; medium_count:number; low_count:number; error?:string; result?:Omit<ReviewResult,"fileName"|"fileSize"|"hasTender"|"reviewedAt"|"durationSec"> };

const nav = [[LayoutDashboard,"工作台"],[FolderKanban,"项目管理"],[FileCheck2,"审核记录"],[BookOpenCheck,"规则库"],[Users,"团队协作"],[Settings,"系统设置"]] as const;
const titles:Record<string,[string,string]> = {
  工作台:["标书智能审核","上传投标文件，由 OpenClaw 执行格式与内容双重审核。"],
  项目管理:["项目管理","管理投标项目，并将每次审核归档到对应项目。"],
  审核记录:["审核记录","查看真实执行状态、风险统计和历史审核报告。"],
  规则库:["审核规则库","维护企业专属审核规则，启用后自动加入 OpenClaw 审核任务。"],
  团队协作:["团队协作","邀请成员并维护审核角色与协作状态。"],
  系统设置:["OpenClaw 连接","配置网关、访问令牌和执行审核的 Agent。"],
};

async function api(path:string, options?:RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json();
  if(!response.ok) throw new Error(data.error || "操作失败");
  return data;
}
function readableSize(bytes:number){return bytes>1024*1024?(bytes/1024/1024).toFixed(1)+" MB":Math.ceil(bytes/1024)+" KB";}
function dateText(value?:string){return value?new Date(value).toLocaleString("zh-CN"):"—";}
function statusText(status:string){return status==="completed"?"已完成":status==="failed"?"失败":status==="running"?"执行中":status;}

export default function Home(){
  const bidInput=useRef<HTMLInputElement>(null), tenderInput=useRef<HTMLInputElement>(null);
  const [active,setActive]=useState("工作台"), [loading,setLoading]=useState(true), [message,setMessage]=useState(""), [error,setError]=useState("");
  const [projects,setProjects]=useState<Project[]>([]), [reviews,setReviews]=useState<ReviewRow[]>([]), [rules,setRules]=useState<Rule[]>([]), [members,setMembers]=useState<Member[]>([]);
  const [settings,setSettings]=useState<SettingsState>({connected:false});
  const [bidFile,setBidFile]=useState<File|null>(null), [tenderFile,setTenderFile]=useState<File|null>(null), [projectId,setProjectId]=useState(""), [analyzing,setAnalyzing]=useState(false), [review,setReview]=useState<ReviewResult|null>(null);
  const [projectForm,setProjectForm]=useState({name:"",client:"",status:"进行中",dueDate:""});
  const [ruleForm,setRuleForm]=useState({name:"",category:"内容",severity:"中风险",description:""});
  const [memberForm,setMemberForm]=useState({name:"",email:"",role:"审核员"});
  const [settingForm,setSettingForm]=useState({baseUrl:"",token:"",agentId:"default"});
  const [selectedRecord,setSelectedRecord]=useState<ReviewDetail|null>(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    const results=await Promise.allSettled([api("/api/projects"),api("/api/reviews"),api("/api/rules"),api("/api/team"),api("/api/settings")]);
    if(results[0].status==="fulfilled") setProjects(results[0].value.results||[]);
    if(results[1].status==="fulfilled") setReviews(results[1].value.results||[]);
    if(results[2].status==="fulfilled") setRules(results[2].value.results||[]);
    if(results[3].status==="fulfilled") setMembers(results[3].value.results||[]);
    if(results[4].status==="fulfilled"){setSettings(results[4].value);setSettingForm(f=>({...f,baseUrl:results[4].value.baseUrl||"",agentId:results[4].value.agentId||"default"}));}
    const failed=results.find(r=>r.status==="rejected"); if(failed&&failed.status==="rejected") setError(failed.reason instanceof Error?failed.reason.message:"数据加载失败");
    setLoading(false);
  },[]);
  useEffect(()=>{queueMicrotask(()=>void refresh());},[refresh]);

  const notify=(value:string)=>{setMessage(value);setError("");setTimeout(()=>setMessage(""),2500);};
  const fail=(cause:unknown)=>setError(cause instanceof Error?cause.message:"操作失败");
  const jsonOptions=(method:string,body:unknown):RequestInit=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

  async function runReview(){
    if(!bidFile){setError("请先选择投标文件");return;}
    setAnalyzing(true);setError("");setReview(null);
    try{
      const form=new FormData();form.append("bidFile",bidFile);if(tenderFile)form.append("tenderFile",tenderFile);if(projectId)form.append("projectId",projectId);
      const data=await api("/api/review",{method:"POST",body:form});
      data.findings=data.findings.map((f:Finding)=>({...f,level:f.severity||f.level}));
      setReview(data);notify("OpenClaw 审核已完成");await refresh();
    }catch(cause){fail(cause);await refresh();}finally{setAnalyzing(false);}
  }
  function exportReport(result=review){
    if(!result)return;
    const lines=["# "+result.fileName+" 审核报告","","- 综合得分："+result.score,"- 审核时间："+dateText(result.reviewedAt),"","## 审核结论","",result.summary,"","## 问题清单",""];
    result.findings.forEach((f,i)=>lines.push("### "+(i+1)+". ["+f.level+"] "+f.title,"","- 类型："+f.category+"审核","- 位置："+f.location,"- 问题："+f.detail,"- 证据："+f.evidence,"- 建议："+f.suggestion,""));
    const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=result.fileName+"-审核报告.md";a.click();URL.revokeObjectURL(url);
  }
  async function addProject(){try{await api("/api/projects",jsonOptions("POST",projectForm));setProjectForm({name:"",client:"",status:"进行中",dueDate:""});notify("项目已创建");await refresh();}catch(cause){fail(cause);}}
  async function deleteProject(id:string){try{await api("/api/projects?id="+encodeURIComponent(id),{method:"DELETE"});notify("项目已删除");await refresh();}catch(cause){fail(cause);}}
  async function addRule(){try{await api("/api/rules",jsonOptions("POST",ruleForm));setRuleForm({name:"",category:"内容",severity:"中风险",description:""});notify("规则已添加");await refresh();}catch(cause){fail(cause);}}
  async function toggleRule(item:Rule,value:boolean){try{await api("/api/rules",jsonOptions("PATCH",{id:item.id,enabled:value}));setRules(old=>old.map(r=>r.id===item.id?{...r,enabled:value}:r));}catch(cause){fail(cause);}}
  async function deleteRule(id:string){try{await api("/api/rules?id="+encodeURIComponent(id),{method:"DELETE"});notify("规则已删除");await refresh();}catch(cause){fail(cause);}}
  async function addMember(){try{await api("/api/team",jsonOptions("POST",memberForm));setMemberForm({name:"",email:"",role:"审核员"});notify("成员邀请已创建");await refresh();}catch(cause){fail(cause);}}
  async function updateMember(item:Member,patch:Partial<Member>){try{await api("/api/team",jsonOptions("PATCH",{...item,...patch}));await refresh();}catch(cause){fail(cause);}}
  async function deleteMember(id:string){try{await api("/api/team?id="+encodeURIComponent(id),{method:"DELETE"});notify("成员已移除");await refresh();}catch(cause){fail(cause);}}
  async function saveSettings(){try{const data=await api("/api/settings",jsonOptions("POST",settingForm));setSettings(data);setSettingForm(f=>({...f,token:""}));notify("OpenClaw 已连接，凭据已加密保存");}catch(cause){fail(cause);}}
  async function disconnect(){try{await api("/api/settings",{method:"DELETE"});setSettings({connected:false});setSettingForm({baseUrl:"",token:"",agentId:"default"});notify("已断开 OpenClaw");}catch(cause){fail(cause);}}
  async function showRecord(id:string){try{setSelectedRecord(await api("/api/reviews?id="+encodeURIComponent(id)));}catch(cause){fail(cause);}}

  const pageTitle=titles[active], counts=review?{high:review.findings.filter(f=>f.level==="高风险").length,medium:review.findings.filter(f=>f.level==="中风险").length,low:review.findings.filter(f=>f.level==="低风险").length}:{high:0,medium:0,low:0};

  return <main className="min-h-screen bg-[#f3f7f8] text-[#172b32]">
    <header className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={24}/></div><div><span>标衡</span><small>BIDWISE</small></div></div><div className="header-search"><Search size={17}/><input placeholder="搜索功能与审核记录"/><kbd>⌘ K</kbd></div><div className="connection-pill"><i className={settings.connected?"online":""}/>{settings.connected?"OpenClaw 已连接":"OpenClaw 未连接"}</div></header>
    <div className="app-shell">
      <aside className="sidebar"><nav>{nav.map(([Icon,label])=><button key={label} className={active===label?"active":""} onClick={()=>setActive(label)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="quota real-service"><div className="quota-icon"><Sparkles size={18}/></div><div><b>真实审核引擎</b><span>OpenClaw + 企业规则</span></div><div className="service-state"><i className={settings.connected?"online":""}/>{settings.connected?"可以执行任务":"等待连接"}</div></div></aside>
      <section className="workspace">
        <div className="page-heading"><div><p className="eyebrow">标衡业务平台</p><h1>{pageTitle[0]}</h1><p>{pageTitle[1]}</p></div>{active!=="工作台"&&<Button variant="outline" onClick={()=>void refresh()} disabled={loading}>刷新数据</Button>}</div>
        {error&&<div className="error-banner"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
        {message&&<div className="success-banner"><CheckCircle2 size={17}/>{message}</div>}
        {loading?<div className="panel loading-panel"><Progress value={70}/><p>正在加载平台数据…</p></div>:<>
          {active==="工作台"&&<div className="page-stack">
            <section className="panel upload-panel upload-real"><div className="upload-copy"><div className="upload-icon"><UploadCloud size={25}/></div><div><h2>上传审核材料</h2><p>支持 PDF、DOCX、TXT、MD，单个文件不超过 5MB</p></div></div><div className="upload-grid">
              <label>归属项目<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">不关联项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <input ref={bidInput} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>setBidFile(e.target.files?.[0]||null)}/><Button variant="outline" onClick={()=>bidInput.current?.click()}><FileText size={16}/>{bidFile?"更换投标文件":"选择投标文件"}</Button>
              <input ref={tenderInput} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>setTenderFile(e.target.files?.[0]||null)}/><Button variant="outline" onClick={()=>tenderInput.current?.click()}><Gavel size={16}/>{tenderFile?"更换招标文件":"添加招标文件"}</Button>
              <Button className="start-review" disabled={!bidFile||analyzing||!settings.connected} onClick={runReview}><Sparkles size={16}/>{analyzing?"OpenClaw 正在审核":"开始真实审核"}</Button>
            </div>{(bidFile||tenderFile)&&<div className="selected-files">{bidFile&&<span><FileText size={14}/><b>投标文件</b>{bidFile.name}<small>{readableSize(bidFile.size)}</small></span>}{tenderFile&&<span><Gavel size={14}/><b>招标文件</b>{tenderFile.name}<small>{readableSize(tenderFile.size)}</small></span>}</div>}
            {!settings.connected&&<button className="inline-link" onClick={()=>setActive("系统设置")}>请先连接 OpenClaw 网关后执行审核 →</button>}</section>
            <section className="panel review-card">{analyzing?<div className="analysis-state"><div className="scan-orbit"><ShieldCheck size={30}/></div><h3>OpenClaw 正在执行审核任务</h3><p>文件、企业规则和格式信号已发送到已配置的 Agent。</p><Progress value={68} className="mt-5 h-2 w-72"/></div>:review?<ReviewReport review={review} counts={counts} onExport={()=>exportReport()}/>:<div className="empty-review"><div><FileCheck2 size={34}/></div><h2>等待审核任务</h2><p>连接 OpenClaw、选择文件并开始审核，结果会自动保存到审核记录。</p></div>}</section>
          </div>}
          {active==="项目管理"&&<div className="manage-layout"><form className="panel form-panel" onSubmit={e=>{e.preventDefault();void addProject();}}><h2><Plus size={18}/>新建项目</h2><label>项目名称<input required value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/></label><label>招标单位<input value={projectForm.client} onChange={e=>setProjectForm({...projectForm,client:e.target.value})}/></label><label>截止日期<input type="date" value={projectForm.dueDate} onChange={e=>setProjectForm({...projectForm,dueDate:e.target.value})}/></label><label>状态<select value={projectForm.status} onChange={e=>setProjectForm({...projectForm,status:e.target.value})}><option>进行中</option><option>已完成</option><option>已归档</option></select></label><Button type="submit">创建项目</Button></form><div className="panel list-panel"><h2>全部项目 <span>{projects.length}</span></h2>{projects.length===0?<Empty text="还没有项目"/>:projects.map(p=><div className="data-row" key={p.id}><div className="row-icon"><FolderKanban size={18}/></div><div className="row-main"><b>{p.name}</b><span>{p.client||"未填写招标单位"} · {p.reviewCount||0} 次审核</span></div><span className="status-chip">{p.status}</span><small>{p.dueDate||"无截止日期"}</small><button className="icon-danger" onClick={()=>void deleteProject(p.id)} aria-label="删除"><Trash2 size={16}/></button></div>)}</div></div>}
          {active==="审核记录"&&<div className="panel list-panel wide"><div className="section-head"><h2>审核任务 <span>{reviews.length}</span></h2><p>执行中、成功和失败任务均会保存</p></div>{reviews.length===0?<Empty text="暂无审核记录"/>:reviews.map(r=><button className="data-row review-row" key={r.id} onClick={()=>void showRecord(r.id)}><div className="row-icon"><FileCheck2 size={18}/></div><div className="row-main"><b>{r.fileName}</b><span>{r.projectName||"未关联项目"} · {dateText(r.createdAt)}</span></div><span className={"status-chip "+r.status}>{statusText(r.status)}</span><strong className="score-cell">{r.score??"—"}</strong><span className="risk-count">高 {r.highCount} · 中 {r.mediumCount} · 低 {r.lowCount}</span></button>)}</div>}
          {active==="规则库"&&<div className="manage-layout"><form className="panel form-panel" onSubmit={e=>{e.preventDefault();void addRule();}}><h2><Plus size={18}/>新增规则</h2><label>规则名称<input required value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm,name:e.target.value})}/></label><div className="split-fields"><label>分类<select value={ruleForm.category} onChange={e=>setRuleForm({...ruleForm,category:e.target.value})}><option>内容</option><option>格式</option></select></label><label>风险等级<select value={ruleForm.severity} onChange={e=>setRuleForm({...ruleForm,severity:e.target.value})}><option>高风险</option><option>中风险</option><option>低风险</option></select></label></div><label>审核要求<textarea required rows={5} value={ruleForm.description} onChange={e=>setRuleForm({...ruleForm,description:e.target.value})}/></label><Button type="submit">加入规则库</Button></form><div className="panel list-panel"><h2>企业规则 <span>{rules.length}</span></h2>{rules.length===0?<Empty text="还没有自定义规则"/>:rules.map(r=><div className="data-row rule-row" key={r.id}><Switch checked={Boolean(r.enabled)} onCheckedChange={v=>void toggleRule(r,v)}/><div className="row-main"><b>{r.name}</b><span>{r.description}</span></div><span className="status-chip">{r.category}</span><small>{r.severity}</small><button className="icon-danger" onClick={()=>void deleteRule(r.id)}><Trash2 size={16}/></button></div>)}</div></div>}
          {active==="团队协作"&&<div className="manage-layout"><form className="panel form-panel" onSubmit={e=>{e.preventDefault();void addMember();}}><h2><Plus size={18}/>邀请成员</h2><label>姓名<input required value={memberForm.name} onChange={e=>setMemberForm({...memberForm,name:e.target.value})}/></label><label>邮箱<input required type="email" value={memberForm.email} onChange={e=>setMemberForm({...memberForm,email:e.target.value})}/></label><label>角色<select value={memberForm.role} onChange={e=>setMemberForm({...memberForm,role:e.target.value})}><option>管理员</option><option>审核员</option><option>观察员</option></select></label><Button type="submit">发送邀请</Button></form><div className="panel list-panel"><h2>团队成员 <span>{members.length}</span></h2>{members.length===0?<Empty text="还没有团队成员"/>:members.map(m=><div className="data-row member-row" key={m.id}><div className="avatar">{m.name.slice(0,1)}</div><div className="row-main"><b>{m.name}</b><span>{m.email}</span></div><select value={m.role} onChange={e=>void updateMember(m,{role:e.target.value})}><option>管理员</option><option>审核员</option><option>观察员</option></select><select value={m.status} onChange={e=>void updateMember(m,{status:e.target.value})}><option>已邀请</option><option>已加入</option><option>已停用</option></select><button className="icon-danger" onClick={()=>void deleteMember(m.id)}><Trash2 size={16}/></button></div>)}</div></div>}
          {active==="系统设置"&&<div className="settings-layout"><form className="panel settings-panel" onSubmit={e=>{e.preventDefault();void saveSettings();}}><div className="settings-status"><div className={settings.connected?"connected-mark connected":"connected-mark"}><ShieldCheck size={26}/></div><div><h2>{settings.connected?"OpenClaw 已连接":"连接 OpenClaw 网关"}</h2><p>{settings.connected?settings.baseUrl:"凭据会在服务端加密保存，不会暴露给页面脚本。"}</p></div></div><label>Gateway HTTPS 地址<input required placeholder="https://openclaw.example.com" value={settingForm.baseUrl} onChange={e=>setSettingForm({...settingForm,baseUrl:e.target.value})}/></label><label>Bearer Token<input required={!settings.connected} type="password" placeholder={settings.connected?"输入新令牌可更新连接":"OpenClaw Gateway Token"} value={settingForm.token} onChange={e=>setSettingForm({...settingForm,token:e.target.value})}/></label><label>Agent ID<input required value={settingForm.agentId} onChange={e=>setSettingForm({...settingForm,agentId:e.target.value})}/></label><div className="form-actions"><Button type="submit">{settings.connected?"更新并测试连接":"保存并测试连接"}</Button>{settings.connected&&<Button type="button" variant="outline" onClick={()=>void disconnect()}>断开连接</Button>}</div></form><aside className="panel guide-panel"><h3>OpenClaw 网关准备</h3><ol><li>为网关配置外部可访问的 HTTPS 地址。</li><li>启用 <code>gateway.http.endpoints.responses.enabled</code>。</li><li>确认 <code>gateway.uploads.enabled</code> 未关闭。</li><li>在 OpenClaw 中安装项目附带的 <code>bid-document-audit</code> 技能。</li></ol><div className="security-note"><AlertTriangle size={17}/><span>Gateway Token 拥有操作员权限，请使用专用网关并限制访问范围。</span></div></aside></div>}
        </>}
        <footer><span>审核引擎：OpenClaw Agent + bid-document-audit Skill</span><span>审核结果用于风险排查，投标前仍应由专业人员终审</span></footer>
      </section>
    </div>
    {selectedRecord&&<div className="modal-backdrop" onClick={()=>setSelectedRecord(null)}><section className="record-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedRecord(null)}><X size={18}/></button><h2>{selectedRecord.file_name}</h2><p>{selectedRecord.projectName||"未关联项目"} · {dateText(selectedRecord.created_at)}</p>{selectedRecord.result?<ReviewReport review={{...selectedRecord.result,fileName:selectedRecord.file_name,fileSize:0,hasTender:Boolean(selectedRecord.tender_file_name),reviewedAt:selectedRecord.completed_at,durationSec:Math.round((selectedRecord.duration_ms||0)/1000),findings:selectedRecord.result.findings.map((f:Finding)=>({...f,level:f.severity||f.level}))}} counts={{high:selectedRecord.high_count,medium:selectedRecord.medium_count,low:selectedRecord.low_count}} onExport={()=>exportReport({...selectedRecord.result,fileName:selectedRecord.file_name,fileSize:0,hasTender:Boolean(selectedRecord.tender_file_name),reviewedAt:selectedRecord.completed_at,durationSec:Math.round((selectedRecord.duration_ms||0)/1000),findings:selectedRecord.result.findings.map((f:Finding)=>({...f,level:f.severity||f.level}))})}/>:<div className="error-banner">{selectedRecord.error||"任务仍在执行"}</div>}</section></div>}
  </main>;
}

function Empty({text}:{text:string}){return <div className="compact-empty"><FileText size={28}/><p>{text}</p></div>;}
function ReviewReport({review,counts,onExport}:{review:ReviewResult;counts:{high:number;medium:number;low:number};onExport:()=>void}){
  return <div className="report-wrap"><div className="review-head"><div className="file-identity"><div className="doc-icon"><FileText size={22}/></div><div><h2>{review.fileName}</h2><p>{dateText(review.reviewedAt)} · {review.durationSec}s</p></div></div><Button variant="outline" onClick={onExport}><Download size={16}/>导出报告</Button></div><div className="score-strip"><div className="score-block"><div className="score-ring"><strong>{review.score}</strong><small>综合得分</small></div><div><b>{review.summary}</b><p>发现 {review.findings.length} 项问题</p></div></div><div className="metric danger"><AlertTriangle size={18}/><div><small>高风险</small><strong>{counts.high}</strong></div></div><div className="metric warning"><CircleHelp size={18}/><div><small>中风险</small><strong>{counts.medium}</strong></div></div><div className="metric safe"><CheckCircle2 size={18}/><div><small>低风险</small><strong>{counts.low}</strong></div></div></div><div className="finding-cards">{review.findings.length===0?<Empty text="未发现明确风险"/>:review.findings.map(f=><article key={f.id} className="finding-card"><div><span className={"risk-badge "+(f.level==="高风险"?"high":f.level==="中风险"?"medium":"low")}>{f.level}</span><span>{f.category}审核</span></div><h3>{f.title}</h3><p>{f.detail}</p><small><FileText size={13}/>{f.location}</small><blockquote>{f.evidence}</blockquote><div className="advice"><Sparkles size={15}/><span>{f.suggestion}</span></div></article>)}</div></div>;
}
