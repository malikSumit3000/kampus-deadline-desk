import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Dashboard from "./Dashboard";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { getAccountAccess } from "@/lib/auth/account-guard";
import { loadDashboard } from "@/lib/dashboard/load-dashboard";

export const metadata: Metadata = {
  title: { absolute: "Kampus — Your deadline runway" },
  description:
    "A privacy-first deadline dashboard pilot for IIMK students.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const access = await getAccountAccess();
  if (!access.ok) {
    if (access.code === "account_blocked") redirect("/api/auth/signout?blocked=1");
    redirect("/login");
  }
  if (!normalizeIimkEmail(access.user.email)) redirect("/login");
  const initialData = await loadDashboard(access.user);
  return <Dashboard key={initialData.generatedAt} initialData={initialData} />;
}
