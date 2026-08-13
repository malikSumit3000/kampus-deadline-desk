import { NextResponse } from "next/server";
import { parseAgendaScope } from "@/lib/manual-deadlines";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = parseAgendaScope(new URL(request.url).searchParams.get("scope"));
  if (!scope) return NextResponse.json({ error: "Invalid task type." }, { status: 400 });
  const { id } = await params;
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user, profile } = access;

  if (scope === "private") {
    const { error } = await supabase.from("private_agendas").delete().eq("id", id).eq("user_id", user.id);
    return error ? NextResponse.json({ error: "Task could not be deleted." }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  if (profile.role !== "moderator") return NextResponse.json({ error: "Only moderators can delete shared tasks." }, { status: 403 });
  const { error } = await supabase.from("agendas").delete().eq("id", id);
  return error ? NextResponse.json({ error: "Shared task could not be deleted." }, { status: 400 }) : NextResponse.json({ ok: true });
}
