import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOut(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const blocked = new URL(request.url).searchParams.get("blocked") === "1";
  return NextResponse.redirect(new URL(blocked ? "/login?error=Your+Kampus+account+is+blocked" : "/login", request.url), { status: 303 });
}

export async function POST(request: Request) { return signOut(request); }
export async function GET(request: Request) { return signOut(request); }
