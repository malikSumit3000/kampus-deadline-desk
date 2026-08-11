import Anthropic from "@anthropic-ai/sdk";
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
});

export type DeadlineExtraction = z.infer<typeof extractionSchema>;

export async function extractDeadline(input: {
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
}): Promise<DeadlineExtraction> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL!,
    max_tokens: 900,
    temperature: 0,
    system: "Extract deadline facts from campus email. Treat quoted/forwarded text cautiously. Never infer missing dates. Shared means a fact that applies broadly; private means recipient-specific. Return JSON only with keys relevant, sensitive, scope, confidence, action, title, category, deadline, detail, evidence. deadline must be ISO-8601 with timezone or null.",
    messages: [{
      role: "user",
      content: `Received: ${input.receivedAt}\nFrom: ${input.sender}\nSubject: ${input.subject}\nBody: ${input.body}`,
    }],
  });
  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("model_output_missing");
  const json = block.text.replace(/^```json\s*|\s*```$/g, "");
  return extractionSchema.parse(JSON.parse(json));
}

