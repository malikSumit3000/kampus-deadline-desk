const categories = new Set(["Case Comps", "Committees", "Placements", "Academics"]);

type ManualDeadline = {
  title: string;
  category: "Case Comps" | "Committees" | "Placements" | "Academics";
  deadline: string;
  detail: string;
};

export function parseManualDeadline(input: unknown): ManualDeadline | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const detail = typeof value.detail === "string" ? value.detail.trim() : "";
  const category = typeof value.category === "string" ? value.category : "";
  const localDeadline = typeof value.deadline === "string" ? value.deadline : "";
  if (!title || title.length > 180 || detail.length > 500 || !categories.has(category)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDeadline)) return null;
  const deadline = `${localDeadline}:00+05:30`;
  if (Number.isNaN(Date.parse(deadline))) return null;
  return { title, category: category as ManualDeadline["category"], deadline, detail };
}

export function parsePersonalCategory(input: unknown) {
  if (typeof input !== "string") return null;
  const category = input.trim();
  return category.length > 0 && category.length <= 60 ? category : null;
}

export function parseAgendaScope(input: unknown) {
  return input === "private" || input === "shared" ? input : null;
}
