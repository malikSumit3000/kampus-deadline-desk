export type ExtractionPolicyInput = {
  relevant: boolean;
  sensitive: boolean;
  scope: "shared" | "private" | "uncertain";
  confidence: number;
  deadline?: string | null;
};

export type ExtractionRoute = "ignore" | "review" | "private";

export function routeExtraction(input: ExtractionPolicyInput): ExtractionRoute {
  if (!input.relevant || !input.deadline) return "ignore";
  if (input.sensitive) return "review";
  return "private";
}
