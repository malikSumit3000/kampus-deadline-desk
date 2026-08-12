import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    code: "ask_kampus_unavailable",
    error: "Ask Kampus is coming soon.",
  }, { status: 410 });
}
