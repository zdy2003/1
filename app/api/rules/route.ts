import { database, jsonError } from "@/lib/database";
export const runtime = "edge";

export async function GET() { try { return Response.json(await database().prepare("SELECT * FROM rules ORDER BY created_at DESC").all()); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) {
  try { const b = await request.json() as Record<string, string>; if (!b.name?.trim() || !b.description?.trim()) return Response.json({ error: "请填写规则名称和内容" }, { status: 400 }); const id=crypto.randomUUID(), now=new Date().toISOString(); await database().prepare("INSERT INTO rules (id,name,category,severity,description,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,b.name.trim(),b.category||"内容",b.severity||"中风险",b.description.trim(),1,now,now).run(); return Response.json({id},{status:201}); } catch(error){ return jsonError(error); }
}
export async function PATCH(request: Request) {
  try { const b=await request.json() as {id?:string;enabled?:boolean}; if(!b.id) return Response.json({error:"缺少规则 ID"},{status:400}); await database().prepare("UPDATE rules SET enabled=?,updated_at=? WHERE id=?").bind(b.enabled?1:0,new Date().toISOString(),b.id).run(); return Response.json({ok:true}); } catch(error){return jsonError(error);}
}
export async function DELETE(request:Request){try{const id=new URL(request.url).searchParams.get("id");if(!id)return Response.json({error:"缺少规则 ID"},{status:400});await database().prepare("DELETE FROM rules WHERE id=?").bind(id).run();return Response.json({ok:true});}catch(error){return jsonError(error);}}
