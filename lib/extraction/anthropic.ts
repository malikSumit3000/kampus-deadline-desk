import Anthropic from "@anthropic-ai/sdk";
import { normaliseDeadlineExtraction, type DeadlineExtraction } from "@/lib/extraction/normalise";

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
  try {
    return normaliseDeadlineExtraction(JSON.parse(json));
  } catch {
    throw new Error("model_output_invalid");
  }
}
