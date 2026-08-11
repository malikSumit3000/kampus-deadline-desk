import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { parseManualDeadline } from "@/lib/manual-deadlines";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const item = parseManualDeadline(await request.json());
  if (!item) return NextResponse.json({ error: "Enter a title, category, and valid deadline." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stableKey = `manual-${randomUUID()}`;
  const { data: agenda, error: agendaError } = await supabase.from("agendas").insert({
    stable_key: stableKey,
    title: item.title,
    category: item.category,
    detail: item.detail,
    source_label: "Verified by moderator",
    confidence: 1,
    created_by: user.id,
    approved_at: new Date().toISOString(),
  }).select("id").single();
  if (agendaError || !agenda) return NextResponse.json({ error: "Could not create the shared deadline." }, { status: 400 });

  const { data: stage, error: stageError } = await supabase.from("agenda_stages").insert({
    agenda_id: agenda.id,
    stable_key: `${stableKey}-stage`,
    name: "Deadline",
    deadline: item.deadline,
    note: "Verified and added by a moderator.",
    position: 1,
  }).select("id").single();
  return stageError
    ? NextResponse.json({ error: "Shared deadline was created without its stage. Please contact the administrator." }, { status: 400 })
    : NextResponse.json({ ok: true, agenda: { id: agenda.id, title: item.title, category: item.category, detail: item.detail, deadline: item.deadline, stageId: stage?.id } });
}
