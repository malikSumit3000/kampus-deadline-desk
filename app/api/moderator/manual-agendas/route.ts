import { NextResponse } from "next/server";
import { parseManualDeadline } from "@/lib/manual-deadlines";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const item = parseManualDeadline(await request.json());
  if (!item) return NextResponse.json({ error: "Enter a title, category, and valid deadline." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
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
