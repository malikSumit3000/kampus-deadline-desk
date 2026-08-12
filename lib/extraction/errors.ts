export type SyncFailure = { code: string; message: string; status: number };

export function classifySyncFailure(error: unknown): SyncFailure {
  const raw = error instanceof Error ? error.message : "sync_failed";
  if (/gmail_(token_refresh_failed|access_token_missing)|gmail_api_(401|403)/.test(raw)) {
    return { code: raw.slice(0, 80), message: "Gmail authorization has expired. Please reconnect Gmail.", status: 401 };
  }
  if (raw === "model_output_invalid" || raw === "model_output_missing") {
    return { code: raw, message: "AI read the email but returned an unusable result. Please retry inbox refresh.", status: 502 };
  }
  if (/credit balance|billing|insufficient[_ ]credits?/i.test(raw)) {
    return { code: "anthropic_credits_unavailable", message: "AI credits are currently unavailable. Gmail is still connected.", status: 503 };
  }
  if (/anthropic|api_error|rate_limit|overloaded|invalid_request/i.test(raw)) {
    return { code: "anthropic_request_failed", message: "AI extraction is temporarily unavailable. Gmail is still connected.", status: 502 };
  }
  return { code: /^[a-z0-9_.-]{1,80}$/i.test(raw) ? raw : "sync_failed", message: "Inbox refresh failed. Please try again.", status: 502 };
}

