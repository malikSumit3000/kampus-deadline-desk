import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Dashboard from "./Dashboard";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { loadDashboard } from "@/lib/dashboard/load-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "Kampus — Your deadline runway" },
  description:
    "A privacy-first deadline dashboard pilot for IIMK students.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !normalizeIimkEmail(user.email)) redirect("/login");
  const initialData = await loadDashboard(user);
  return <Dashboard key={initialData.generatedAt} initialData={initialData} />;
}
