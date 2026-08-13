export const extractionTool = {
  name: "record_deadline_extraction",
  description: "Record every evidence-bound actionable deadline in a campus email.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      tasks: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            relevant: { type: "boolean" },
            sensitive: { type: "boolean" },
            scope: { type: "string", enum: ["shared", "private", "uncertain"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            action: { type: "string", enum: ["new", "extension", "correction"] },
            title: { type: "string", minLength: 1, maxLength: 180 },
            category: { type: "string", enum: ["Case Comps", "Committees", "Placements", "Academics"] },
            deadline: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
            detail: { type: "string", maxLength: 500 },
            evidence: { type: "string", maxLength: 300 },
            agendaId: {
              anyOf: [
                { type: "string", format: "uuid", description: "Exact id from CURRENT STATE when updating or adding a stage." },
                { type: "null" },
              ],
            },
            isNewStage: { type: "boolean" },
          },
          required: ["relevant", "sensitive", "scope", "confidence", "action", "title", "category", "deadline", "detail", "evidence", "agendaId", "isNewStage"],
        },
      },
    },
    required: ["tasks"],
  },
};

type ContentBlock = { type?: unknown; name?: unknown; input?: unknown };

export function readExtractionToolInput(content: ContentBlock[]) {
  const block = content.find((item) => item.type === "tool_use" && item.name === extractionTool.name);
  if (!block) throw new Error("model_output_missing");
  return block.input;
}
