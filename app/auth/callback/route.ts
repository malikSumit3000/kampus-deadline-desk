import { NextResponse } from "next/server";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (!code) return NextResponse.redirect(new URL("/login?error=Google+sign-in+was+cancelled", url));

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/login?error=Could+not+complete+Google+sign-in", url));

  const { data: { user } } = await supabase.auth.getUser();
  const email = normalizeIimkEmail(user?.email);
  const verified = Boolean(user?.email_confirmed_at) && user?.app_metadata?.provider === "google";

  if (!user || !email || !verified) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=Use+your+verified+IIMK+Google+account", url));
  }

  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    display_name: user.user_metadata?.full_name ?? email.split("@")[0],
    avatar_url: user.user_metadata?.avatar_url ?? null,
  }, { onConflict: "id" });

  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=Your+profile+could+not+be+created", url));
  }

  return NextResponse.redirect(new URL("/", url));
}
