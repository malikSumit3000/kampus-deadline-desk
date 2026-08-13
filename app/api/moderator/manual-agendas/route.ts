import { NextResponse } from "next/server";
import { parseManualDeadline } from "@/lib/manual-deadlines";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function POST(request: Request) {
  const item = parseManualDeadline(await request.json());
  if (!item) return NextResponse.json({ error: "Enter a title, category, and valid deadline." }, { status: 400 });

  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { user, profile, admin } = access;
  if (profile.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await admin.rpc("create_shared_agenda", {
    p_actor_id: user.id,
    p_title: item.title,
    p_category: item.category,
    p_detail: item.detail,
    p_deadline: item.deadline,
  });
  const created = Array.isArray(data) ? data[0] : null;
  return error || !created?.agenda_id || !created?.stage_id
    ? NextResponse.json({ error: "Could not create the shared deadline." }, { status: 400 })
    : NextResponse.json({ ok: true, agenda: { id: created.agenda_id, title: item.title, category: item.category, detail: item.detail, deadline: item.deadline, stageId: created.stage_id } });
}
