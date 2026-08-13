import Anthropic from "@anthropic-ai/sdk";
import {
  buildDeadlineExtractionPrompt,
  deadlineExtractionSystemPrompt,
  todayInKolkata,
  validateExtractionTargets,
  type ExistingDeadlineState,
  type ExtractionMessage,
} from "@/lib/extraction/context";
import { normaliseDeadlineExtractions, type DeadlineExtraction } from "@/lib/extraction/normalise";
import { extractionTool, readExtractionToolInput } from "@/lib/extraction/tool-contract";

export async function extractDeadline(input: {
  messages: ExtractionMessage[];
  currentState: ExistingDeadlineState[];
  today?: string;
}): Promise<DeadlineExtraction[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_EXTRACTION_MODEL ?? process.env.ANTHROPIC_MODEL!,
    max_tokens: 2600,
    temperature: 0,
    system: deadlineExtractionSystemPrompt,
    tools: [extractionTool],
    tool_choice: { type: "tool", name: extractionTool.name, disable_parallel_tool_use: true },
    messages: [{
      role: "user",
      content: buildDeadlineExtractionPrompt({
        messages: input.messages,
        currentState: input.currentState,
        today: input.today ?? todayInKolkata(),
      }),
    }],
  });
  try {
    return validateExtractionTargets(
      normaliseDeadlineExtractions(readExtractionToolInput(response.content)),
      input.currentState,
    );
  } catch {
    throw new Error("model_output_invalid");
  }
}
