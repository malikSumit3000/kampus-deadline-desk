import { NextResponse } from "next/server";
import { parseAgendaScope } from "@/lib/manual-deadlines";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = parseAgendaScope(new URL(request.url).searchParams.get("scope"));
  if (!scope) return NextResponse.json({ error: "Invalid task type." }, { status: 400 });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (scope === "private") {
    const { error } = await supabase.from("private_agendas").delete().eq("id", id).eq("user_id", user.id);
    return error ? NextResponse.json({ error: "Task could not be deleted." }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "moderator") return NextResponse.json({ error: "Only moderators can delete shared tasks." }, { status: 403 });
  const { error } = await supabase.from("agendas").delete().eq("id", id);
  return error ? NextResponse.json({ error: "Shared task could not be deleted." }, { status: 400 }) : NextResponse.json({ ok: true });
}
