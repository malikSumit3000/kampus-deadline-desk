export type ParsedSseEvent = { event: string; data: unknown };

export function consumeSseChunk(buffer: string, chunk: string) {
  const frames = `${buffer}${chunk}`.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events: ParsedSseEvent[] = [];
  for (const frame of frames) {
    const lines = frame.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
    const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
    if (!event || data === undefined) continue;
    events.push({ event, data: JSON.parse(data) as unknown });
  }
  return { events, remainder };
}

export function citationParts(text: string) {
  return text.split(/(\[S\d+\])/g).filter(Boolean).map((value) => {
    const match = /^\[(S\d+)\]$/.exec(value);
    return match
      ? { type: "citation" as const, value: match[1] }
      : { type: "text" as const, value };
  });
}
