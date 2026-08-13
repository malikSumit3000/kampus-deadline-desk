import { NextResponse } from "next/server";
import { parsePersonalCategory } from "@/lib/manual-deadlines";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function POST(request: Request) {
  const { category: rawCategory } = (await request.json()) as { category?: unknown };
  const category = parsePersonalCategory(rawCategory);
  if (!category) return NextResponse.json({ error: "Enter a category name of up to 60 characters." }, { status: 400 });

  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user } = access;
  const { error } = await supabase.from("user_categories").upsert({ user_id: user.id, category });
  return error ? NextResponse.json({ error: "Category could not be saved." }, { status: 400 }) : NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { agendaId?: string; privateAgendaId?: string; category?: unknown };
  const category = parsePersonalCategory(body.category);
  const hasSharedAgenda = typeof body.agendaId === "string";
  const hasPrivateAgenda = typeof body.privateAgendaId === "string";
  if (!category || hasSharedAgenda === hasPrivateAgenda) return NextResponse.json({ error: "Choose one deadline and a valid category." }, { status: 400 });

  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { supabase, user } = access;

  const { error } = hasSharedAgenda
    ? await supabase.from("user_agenda_category_overrides").upsert({ user_id: user.id, agenda_id: body.agendaId!, category, updated_at: new Date().toISOString() })
    : await supabase.from("private_agendas").update({ category, updated_at: new Date().toISOString() }).eq("id", body.privateAgendaId!).eq("user_id", user.id);
  return error ? NextResponse.json({ error: "Category could not be saved." }, { status: 400 }) : NextResponse.json({ ok: true });
}
