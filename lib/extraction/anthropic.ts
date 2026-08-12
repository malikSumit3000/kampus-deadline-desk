import Anthropic from "@anthropic-ai/sdk";
import { normaliseDeadlineExtractions, type DeadlineExtraction } from "@/lib/extraction/normalise";
import { extractionTool, readExtractionToolInput } from "@/lib/extraction/tool-contract";

export async function extractDeadline(input: {
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
}): Promise<DeadlineExtraction[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL!,
    max_tokens: 1800,
    temperature: 0,
    system: "Read the entire campus email and extract every distinct actionable task that has an explicit deadline. Do not rely on keywords. Understand the sender, subject, context, quoted updates, extensions, corrections, relative dates, and all dates. Treat quoted or forwarded text cautiously and prefer the newest instruction. Resolve explicit relative dates from the Received timestamp. Never invent a date. If a date is explicit but no time is stated, use 23:59 Asia/Kolkata and say in detail that the sender did not specify a time. If an email has no explicit actionable deadline, return an empty tasks array. Create a concise task title and preserve useful submission instructions in detail. Classify coursework, quizzes, exams, faculty submissions, and course administration as Academics; competitions and external challenges as Case Comps; campus clubs and student bodies as Committees; recruitment, applications, interviews, and company processes as Placements. Shared means broadly applicable and private means recipient-specific. Use the provided tool exactly once. Every deadline must be ISO-8601 with timezone or null.",
    tools: [extractionTool],
    tool_choice: { type: "tool", name: extractionTool.name, disable_parallel_tool_use: true },
    messages: [{
      role: "user",
      content: `Received: ${input.receivedAt}\nFrom: ${input.sender}\nSubject: ${input.subject}\nBody: ${input.body}`,
    }],
  });
  try {
    return normaliseDeadlineExtractions(readExtractionToolInput(response.content));
  } catch {
    throw new Error("model_output_invalid");
  }
}
