import Anthropic from "@anthropic-ai/sdk";
import { normaliseDeadlineExtraction, type DeadlineExtraction } from "@/lib/extraction/normalise";
import { extractionTool, readExtractionToolInput } from "@/lib/extraction/tool-contract";

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
    system: "Extract deadline facts from campus email. Treat quoted/forwarded text cautiously. Never infer missing dates. Shared means a fact that applies broadly; private means recipient-specific. Use the provided tool exactly once. deadline must be ISO-8601 with timezone or null.",
    tools: [extractionTool],
    tool_choice: { type: "tool", name: extractionTool.name, disable_parallel_tool_use: true },
    messages: [{
      role: "user",
      content: `Received: ${input.receivedAt}\nFrom: ${input.sender}\nSubject: ${input.subject}\nBody: ${input.body}`,
    }],
  });
  try {
    return normaliseDeadlineExtraction(readExtractionToolInput(response.content));
  } catch {
    throw new Error("model_output_invalid");
  }
}
