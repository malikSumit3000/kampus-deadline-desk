export type ExtractionPolicyInput = {
  relevant: boolean;
  sensitive: boolean;
  scope: "shared" | "private" | "uncertain";
  confidence: number;
};

export type ExtractionRoute = "ignore" | "review" | "private" | "moderator";

export function routeExtraction(input: ExtractionPolicyInput): ExtractionRoute {
  if (!input.relevant) return "ignore";
  if (input.sensitive || input.scope === "uncertain" || input.confidence < 0.9) {
    return "review";
  }
  if (input.scope === "private") return "private";
  return input.confidence >= 0.95 ? "moderator" : "review";
}

