import { NextResponse } from "next/server";
import { parseManualDeadline } from "@/lib/manual-deadlines";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function POST(request: Request) {
  const item = parseManualDeadline(await request.json());
  if (!item) return NextResponse.json({ error: "Enter a title, category, and valid deadline." }, { status: 400 });

  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user } = access;

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
