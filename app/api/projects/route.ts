import { database, jsonError } from "@/lib/database";

export const runtime = "edge";

export async function GET() {
  try { return Response.json(await database().prepare("SELECT p.id,p.name,p.client,p.status,p.due_date AS dueDate,p.created_at AS createdAt,p.updated_at AS updatedAt,COUNT(r.id) AS reviewCount FROM projects p LEFT JOIN reviews r ON r.project_id=p.id GROUP BY p.id ORDER BY p.updated_at DESC").all()); }
  catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, string>;
    if (!body.name?.trim()) return Response.json({ error: "请输入项目名称" }, { status: 400 });
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await database().prepare("INSERT INTO projects (id,name,client,status,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id, body.name.trim(), body.client?.trim() || "", body.status || "进行中", body.dueDate || null, now, now).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, string>;
    if (!body.id) return Response.json({ error: "缺少项目 ID" }, { status: 400 });
    await database().prepare("UPDATE projects SET name=?,client=?,status=?,due_date=?,updated_at=? WHERE id=?").bind(body.name, body.client || "", body.status || "进行中", body.dueDate || null, new Date().toISOString(), body.id).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try { const id = new URL(request.url).searchParams.get("id"); if (!id) return Response.json({ error: "缺少项目 ID" }, { status: 400 }); await database().prepare("DELETE FROM projects WHERE id=?").bind(id).run(); return Response.json({ ok: true }); }
  catch (error) { return jsonError(error); }
}
