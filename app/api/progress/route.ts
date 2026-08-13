import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/account-guard";

const statuses = new Set(["to-do", "in progress", "submitted"]);

export async function PATCH(request: Request) {
  const body = (await request.json()) as { stageId?: string; status?: string };
  if (!body.stageId || !body.status || !statuses.has(body.status)) return NextResponse.json({ error: "Invalid progress" }, { status: 400 });
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user } = access;

  const isPrivate = body.stageId.startsWith("private:");
  const query = isPrivate
    ? supabase.from("private_agendas").update({ status: body.status }).eq("id", body.stageId.slice(8)).eq("user_id", user.id)
    : supabase.from("user_progress").upsert({ user_id: user.id, stage_id: body.stageId, status: body.status });
  const { error } = await query;
  return error ? NextResponse.json({ error: "Save failed" }, { status: 400 }) : NextResponse.json({ ok: true });
}
