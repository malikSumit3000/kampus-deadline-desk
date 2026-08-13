import { z } from "zod";

export const extractionSchema = z.object({
  relevant: z.boolean(),
  sensitive: z.boolean(),
  scope: z.enum(["shared", "private", "uncertain"]),
  confidence: z.number().min(0).max(1),
  action: z.enum(["new", "extension", "correction"]),
  title: z.string().min(1).max(180),
  category: z.enum(["Case Comps", "Committees", "Placements", "Academics"]),
  deadline: z.string().datetime({ offset: true }).nullable(),
  detail: z.string().max(500),
  evidence: z.string().max(300),
  agendaId: z.string().uuid().nullable(),
  isNewStage: z.boolean(),
});

export type DeadlineExtraction = z.infer<typeof extractionSchema>;

function normaliseConfidence(value: unknown) {
  if (typeof value === "number") return value > 1 && value <= 100 ? value / 100 : value;
  if (typeof value !== "string") return value;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (!match) return value;
  const numeric = Number(match[1]);
  return value.includes("%") || numeric > 1 ? numeric / 100 : numeric;
}

function normaliseAction(value: unknown) {
  if (typeof value !== "string") return value;
  const compact = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (/^(new|new deadline|create|add)$/.test(compact)) return "new";
  if (/^(extension|deadline extension|extended)$/.test(compact)) return "extension";
  if (/^(correction|deadline correction|corrected|update)$/.test(compact)) return "correction";
  return value;
}

function normaliseCategory(value: unknown) {
  if (typeof value !== "string") return value;
  const match = ["Case Comps", "Committees", "Placements", "Academics"]
    .find((category) => category.toLowerCase() === value.trim().toLowerCase());
  return match ?? value;
}

export function normaliseDeadlineExtraction(value: unknown): DeadlineExtraction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("model_output_invalid");
  const input = value as Record<string, unknown>;
  const parsed = extractionSchema.safeParse({
    ...input,
    confidence: normaliseConfidence(input.confidence),
    action: normaliseAction(input.action),
    category: normaliseCategory(input.category),
  });
  if (!parsed.success) throw new Error("model_output_invalid");
  return parsed.data;
}

export function normaliseDeadlineExtractions(value: unknown): DeadlineExtraction[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("model_output_invalid");
  const tasks = (value as Record<string, unknown>).tasks;
  if (!Array.isArray(tasks) || tasks.length > 12) throw new Error("model_output_invalid");
  return tasks.map(normaliseDeadlineExtraction);
}
