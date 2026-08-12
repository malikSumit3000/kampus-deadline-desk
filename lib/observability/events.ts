type OperationalInput = Record<string, unknown> & {
  operation: "gmail_sync" | "ask_kampus";
  status: "succeeded" | "failed" | "blocked";
};

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeErrorCode(value: unknown) {
  return typeof value === "string" && /^[a-z0-9_.-]{1,80}$/i.test(value) ? value : "unknown_error";
}

export function buildOperationalEvent(input: OperationalInput) {
  const event: Record<string, string | number> = {
    operation: input.operation,
    status: input.status,
    duration_ms: safeCount(input.durationMs),
  };
  if (input.operation === "gmail_sync") {
    event.messages_processed = safeCount(input.messagesProcessed);
    event.candidates_found = safeCount(input.candidatesFound);
  } else {
    event.source_count = safeCount(input.sourceCount);
    event.input_tokens = safeCount(input.inputTokens);
    event.output_tokens = safeCount(input.outputTokens);
  }
  if (input.status !== "succeeded") event.error_code = safeErrorCode(input.errorCode);
  return event;
}

export function logOperationalEvent(input: OperationalInput) {
  console.info(JSON.stringify(buildOperationalEvent(input)));
}
