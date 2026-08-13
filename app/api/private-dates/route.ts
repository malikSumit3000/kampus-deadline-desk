import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function PUT(request: Request) {
  const body = (await request.json()) as { stageId?: string; deadline?: string | null };
  if (!body.stageId || (body.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(body.deadline))) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user } = access;

  let error;
  if (body.stageId.startsWith("private:")) {
    ({ error } = await supabase.from("private_agendas").update({ private_override: body.deadline }).eq("id", body.stageId.slice(8)).eq("user_id", user.id));
  } else if (body.deadline) {
    ({ error } = await supabase.from("private_deadline_overrides").upsert({ user_id: user.id, stage_id: body.stageId, deadline: body.deadline }));
  } else {
    ({ error } = await supabase.from("private_deadline_overrides").delete().eq("user_id", user.id).eq("stage_id", body.stageId));
  }
  return error ? NextResponse.json({ error: "Save failed" }, { status: 400 }) : NextResponse.json({ ok: true });
}
