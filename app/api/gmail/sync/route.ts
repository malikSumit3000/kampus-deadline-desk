import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { extractDeadline } from "@/lib/extraction/anthropic";
import { routeExtraction } from "@/lib/extraction/policy";
import { getGmailMessage, isSensitiveMessage, listCandidateMessageIds, refreshGoogleAccessToken, summariseMessage } from "@/lib/gmail/client";
import { decryptToken } from "@/lib/security/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin.from("gmail_connections").select("*")
    .eq("user_id", user.id).is("revoked_at", null).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Gmail is not connected" }, { status: 409 });
  const { data: run, error: runError } = await admin.from("sync_runs")
    .insert({ user_id: user.id, status: "running" }).select("id").single();
  if (runError) return NextResponse.json({ error: "Could not start sync" }, { status: 500 });

  let scanned = 0;
  let candidates = 0;
  try {
    const refreshToken = decryptToken(connection.encrypted_refresh_token, process.env.TOKEN_ENCRYPTION_KEY!);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const ids = await listCandidateMessageIds(accessToken, connection.scan_after);

    for (const id of ids) {
      const { data: existing } = await admin.from("gmail_message_receipts")
        .select("message_id").eq("user_id", user.id).eq("message_id", id).maybeSingle();
      if (existing) continue;

      const message = await getGmailMessage(id, accessToken);
      const summary = summariseMessage(message);
      scanned += 1;
      let outcome = "ignored";

      if (isSensitiveMessage(summary)) {
        await admin.from("review_items").insert({
          user_id: user.id,
          kind: "Sensitive message",
          title: summary.subject,
          reason: "Potentially sensitive roster or personal document; model extraction was bypassed.",
          gmail_message_id: id,
          received_at: summary.receivedAt,
        });
        outcome = "review";
        candidates += 1;
      } else {
        const extraction = await extractDeadline(summary);
        const route = routeExtraction(extraction);
        outcome = route;
        if (route !== "ignore") candidates += 1;

        if (route === "review") {
          await admin.from("review_items").insert({
            user_id: user.id,
            kind: `Needs review · ${Math.round(extraction.confidence * 100)}%`,
            title: extraction.title,
            reason: extraction.evidence || "The extracted deadline is not safe to add automatically.",
            proposed_deadline: extraction.deadline,
            gmail_message_id: id,
            extraction,
            received_at: summary.receivedAt,
          });
        } else if (route === "private" && extraction.deadline) {
          await admin.from("private_agendas").insert({
            user_id: user.id,
            title: extraction.title,
            category: extraction.category,
            detail: extraction.detail,
            source_label: summary.sender,
            confidence: extraction.confidence,
            deadline: extraction.deadline,
          });
        } else if (route === "moderator" && extraction.deadline) {
          await admin.from("moderator_proposals").insert({
            action: extraction.action,
            title: extraction.title,
            before_value: extraction.action === "new" ? "No shared record" : "Existing shared date",
            proposed_value: extraction.deadline,
            source_summary: `IIMK message · ${summary.sender}`,
            confidence: extraction.confidence,
            payload: extraction,
            submitted_by: user.id,
          });
        }
      }

      await admin.from("gmail_message_receipts").insert({
        user_id: user.id,
        message_id: id,
        thread_id: message.threadId,
        internal_date: summary.receivedAt,
        extraction_outcome: outcome,
        content_hash: createHash("sha256").update(`${summary.subject}\n${summary.body}`).digest("hex"),
      });
    }

    const now = new Date().toISOString();
    await Promise.all([
      admin.from("sync_runs").update({ status: "succeeded", finished_at: now, messages_scanned: scanned, candidates_found: candidates }).eq("id", run.id),
      admin.from("gmail_connections").update({ last_sync_at: now, last_error: null, updated_at: now }).eq("user_id", user.id),
    ]);
    return NextResponse.json({ scanned, candidates, lastSyncAt: now });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "sync_failed";
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("sync_runs").update({ status: "failed", finished_at: now, messages_scanned: scanned, candidates_found: candidates, error_code: code }).eq("id", run.id),
      admin.from("gmail_connections").update({ last_error: code, updated_at: now }).eq("user_id", user.id),
    ]);
    return NextResponse.json({ error: "Sync failed. Reconnect Gmail if this continues." }, { status: 502 });
  }
}
