import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Agenda, ReviewItem } from "@/app/dashboard-data";
import { makeManualAgenda } from "@/lib/dashboard/optimistic";
import { extractDeadline } from "@/lib/extraction/anthropic";
import { classifySyncFailure } from "@/lib/extraction/errors";
import { routeExtraction } from "@/lib/extraction/policy";
import { shouldCompleteBackfill } from "@/lib/gmail/backfill";
import { getGmailMessage, isSensitiveMessage, listCandidateMessageIds, refreshGoogleAccessToken, selectSyncCandidates, summariseMessage } from "@/lib/gmail/client";
import { classifyShortlistDeadline } from "@/lib/gmail/shortlist";
import { parseSyncLease } from "@/lib/reliability/rpc-contracts";
import { logOperationalEvent } from "@/lib/observability/events";
import { decryptToken } from "@/lib/security/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export async function POST() {
  const requestStartedAt = Date.now();
  const syncStartedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin.from("gmail_connections").select("*")
    .eq("user_id", user.id).is("revoked_at", null).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Gmail is not connected" }, { status: 409 });
  const { data: leaseData, error: leaseError } = await admin.rpc("start_gmail_sync", {
    p_user_id: user.id,
    p_lease_seconds: 75,
  });
  if (leaseError) return NextResponse.json({ error: "Could not start sync" }, { status: 500 });
  const lease = parseSyncLease(leaseData);
  if (!lease) {
    logOperationalEvent({ operation: "gmail_sync", status: "blocked", durationMs: Date.now() - requestStartedAt, messagesProcessed: 0, candidatesFound: 0, errorCode: "sync_lease_held" });
    return NextResponse.json({ error: "An inbox refresh is already running." }, { status: 409 });
  }

  let scanned = 0;
  let candidates = 0;
  const processedIds: string[] = [];
  const privateAgendas: Agenda[] = [];
  const newReviews: ReviewItem[] = [];
  try {
    const refreshToken = decryptToken(connection.encrypted_refresh_token, process.env.TOKEN_ENCRYPTION_KEY!);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const candidateIds = await listCandidateMessageIds(accessToken, connection.scan_after);
    const { data: receipts, error: receiptsError } = candidateIds.length === 0
      ? { data: [], error: null }
      : await admin.from("gmail_message_receipts")
        .select("message_id,processing_status,attempt_count,updated_at")
        .eq("user_id", user.id)
        .in("message_id", candidateIds);
    if (receiptsError) throw new Error("gmail_receipts_lookup_failed");
    const ids = selectSyncCandidates(candidateIds, receipts ?? []);

    for (const id of ids) {
      const message = await getGmailMessage(id, accessToken);
      const summary = summariseMessage(message);
      const { data: claimed, error: claimError } = await admin.rpc("claim_gmail_message", {
        p_user_id: user.id,
        p_message_id: id,
        p_thread_id: message.threadId ?? null,
        p_internal_date: summary.receivedAt,
      });
      if (claimError) throw new Error("gmail_message_claim_failed");
      if (claimed !== true) continue;

      scanned += 1;
      let outcome = "ignored";
      try {
        const shortlist = classifyShortlistDeadline(summary);
        if (shortlist.kind === "deadline") {
          const { data: agenda, error: agendaError } = await admin.from("private_agendas").insert({
            user_id: user.id,
            title: "Shortlist action deadline",
            category: "Placements",
            detail: "Open the original email for the action instructions.",
            source_label: "Gmail · sensitive details withheld",
            confidence: 1,
            deadline: shortlist.deadline,
          }).select("id,title,category,detail,source_label,confidence,deadline,status").single();
          if (agendaError || !agenda) throw new Error("private_agenda_insert_failed");
          privateAgendas.push(makeManualAgenda({
            id: agenda.id,
            title: agenda.title,
            category: agenda.category,
            detail: agenda.detail,
            deadline: agenda.deadline,
            scope: "private",
            source: agenda.source_label,
            confidence: Number(agenda.confidence),
            status: agenda.status,
          }));
          outcome = "private";
          candidates += 1;
        } else if (shortlist.kind === "review") {
          const reason = "This shortlist message contains an action date but no exact time. Open Gmail to verify the deadline.";
          const { data: review, error: reviewError } = await admin.from("review_items").insert({
            user_id: user.id,
            kind: "Date needs review",
            title: "Shortlist action deadline",
            reason,
            gmail_message_id: id,
            received_at: summary.receivedAt,
          }).select("id,kind,title,reason,proposed_deadline,received_at,gmail_message_id").single();
          if (reviewError || !review) throw new Error("review_item_insert_failed");
          newReviews.push({
            id: review.id,
            kind: review.kind,
            title: review.title,
            received: dateLabel(review.received_at),
            reason: review.reason,
            proposedDate: "Time not stated",
            source: "Open in Gmail",
            canAddToDashboard: false,
          });
          outcome = "review";
          candidates += 1;
        } else if (shortlist.kind === "ignore") {
          outcome = "ignored_sensitive";
        } else if (isSensitiveMessage(summary)) {
          const reason = "Potentially sensitive roster or personal document; model extraction was bypassed.";
          const { data: review, error: reviewError } = await admin.from("review_items").insert({
            user_id: user.id,
            kind: "Sensitive message",
            title: summary.subject,
            reason,
            gmail_message_id: id,
            received_at: summary.receivedAt,
          }).select("id,kind,title,reason,proposed_deadline,received_at,gmail_message_id").single();
          if (reviewError || !review) throw new Error("review_item_insert_failed");
          newReviews.push({
            id: review.id,
            kind: review.kind,
            title: review.title,
            received: dateLabel(review.received_at),
            reason: review.reason,
            proposedDate: "No deadline extracted",
            source: "Open in Gmail",
            canAddToDashboard: false,
          });
          outcome = "review";
          candidates += 1;
        } else {
          const extraction = await extractDeadline(summary);
          const route = routeExtraction(extraction);
          outcome = route;
          if (route !== "ignore") candidates += 1;

          if (route === "review") {
            const reason = extraction.evidence || "The extracted deadline is not safe to add automatically.";
            const { data: review, error: reviewError } = await admin.from("review_items").insert({
              user_id: user.id,
              kind: `Needs review · ${Math.round(extraction.confidence * 100)}%`,
              title: extraction.title,
              reason,
              proposed_deadline: extraction.deadline,
              gmail_message_id: id,
              extraction,
              received_at: summary.receivedAt,
            }).select("id,kind,title,reason,proposed_deadline,received_at,gmail_message_id").single();
            if (reviewError || !review) throw new Error("review_item_insert_failed");
            newReviews.push({
              id: review.id,
              kind: review.kind,
              title: review.title,
              received: dateLabel(review.received_at),
              reason: review.reason,
              proposedDate: review.proposed_deadline ? dateLabel(review.proposed_deadline) : "No deadline extracted",
              source: "Open in Gmail",
              canAddToDashboard: Boolean(review.proposed_deadline),
            });
          } else if (route === "private" && extraction.deadline) {
            const { data: agenda, error: agendaError } = await admin.from("private_agendas").insert({
              user_id: user.id,
              title: extraction.title,
              category: extraction.category,
              detail: extraction.detail,
              source_label: summary.sender,
              confidence: extraction.confidence,
              deadline: extraction.deadline,
            }).select("id,title,category,detail,source_label,confidence,deadline,status").single();
            if (agendaError || !agenda) throw new Error("private_agenda_insert_failed");
            privateAgendas.push(makeManualAgenda({
              id: agenda.id,
              title: agenda.title,
              category: agenda.category,
              detail: agenda.detail,
              deadline: agenda.deadline,
              scope: "private",
              source: agenda.source_label,
              confidence: Number(agenda.confidence),
              status: agenda.status,
            }));
          }
        }

        const { error: receiptError } = await admin.from("gmail_message_receipts").update({
          extraction_outcome: outcome,
          processing_status: "succeeded",
          content_hash: createHash("sha256").update(`${summary.subject}\n${summary.body}`).digest("hex"),
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("message_id", id);
        if (receiptError) throw new Error("gmail_receipt_update_failed");
        processedIds.push(id);
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 80) : "message_processing_failed";
        await admin.from("gmail_message_receipts").update({
          processing_status: "failed",
          last_error: code,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("message_id", id);
        throw error;
      }
    }

    const now = new Date().toISOString();
    const backfillComplete = !connection.backfill_completed_at && shouldCompleteBackfill(candidateIds, receipts ?? [], processedIds);
    const connectionUpdate = backfillComplete
      ? { last_sync_at: now, last_error: null, scan_after: syncStartedAt, backfill_completed_at: now, updated_at: now }
      : { last_sync_at: now, last_error: null, updated_at: now };
    await Promise.all([
      admin.from("sync_runs").update({ status: "succeeded", finished_at: now, messages_scanned: scanned, candidates_found: candidates }).eq("id", lease.runId),
      admin.from("gmail_connections").update(connectionUpdate).eq("user_id", user.id),
    ]);
    logOperationalEvent({ operation: "gmail_sync", status: "succeeded", durationMs: Date.now() - requestStartedAt, messagesProcessed: scanned, candidatesFound: candidates });
    return NextResponse.json({ scanned, candidates, lastSyncAt: now, privateAgendas, reviews: newReviews });
  } catch (error) {
    const failure = classifySyncFailure(error);
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("sync_runs").update({ status: "failed", finished_at: now, messages_scanned: scanned, candidates_found: candidates, error_code: failure.code }).eq("id", lease.runId),
      admin.from("gmail_connections").update({ last_error: failure.code, updated_at: now }).eq("user_id", user.id),
    ]);
    logOperationalEvent({ operation: "gmail_sync", status: "failed", durationMs: Date.now() - requestStartedAt, messagesProcessed: scanned, candidatesFound: candidates, errorCode: failure.code });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
