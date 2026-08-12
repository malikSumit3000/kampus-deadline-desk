export type Category = string;

export type StageStatus = "to-do" | "in progress" | "submitted";
export type AppView = "dashboard" | "reviews" | "moderator" | "privacy";

export type AgendaStage = {
  id: string;
  name: string;
  deadline: string;
  displayDate: string;
  status: StageStatus;
  note: string;
};

export type Agenda = {
  id: string;
  title: string;
  category: Exclude<Category, "All">;
  scope: "shared" | "private";
  urgency: "now" | "soon" | "steady";
  countdown: string;
  deadline: string;
  displayDate: string;
  detail: string;
  source: string;
  confidence: number;
  stages: AgendaStage[];
};

export type ReviewItem = {
  id: string;
  kind: string;
  title: string;
  received: string;
  reason: string;
  proposedDate: string;
  source: string;
  canAddToDashboard: boolean;
};

export type ModeratorProposal = {
  id: string;
  action: "extension" | "new" | "correction";
  title: string;
  match: string;
  before: string;
  after: string;
  source: string;
  confidence: number;
};

export const categories: Category[] = [
  "All",
  "Case Comps",
  "Committees",
  "Placements",
  "Academics",
];

export function categoryTabs(availableCategories: string[]) {
  const standard = new Set(categories);
  const custom = [...new Set(availableCategories.filter((category) => !standard.has(category)))];
  return [...categories, ...custom];
}
