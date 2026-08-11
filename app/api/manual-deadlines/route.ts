import { NextResponse } from "next/server";
import { parseManualDeadline } from "@/lib/manual-deadlines";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const item = parseManualDeadline(await request.json());
  if (!item) return NextResponse.json({ error: "Enter a title, category, and valid deadline." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("private_agendas").insert({
    user_id: user.id,
    title: item.title,
    category: item.category,
    detail: item.detail,
    source_label: "Added by you",
    confidence: 1,
    deadline: item.deadline,
  }).select("id,title,category,detail,deadline").single();
  return error
    ? NextResponse.json({ error: "Could not save your deadline." }, { status: 400 })
    : NextResponse.json({ ok: true, agenda: data });
}
