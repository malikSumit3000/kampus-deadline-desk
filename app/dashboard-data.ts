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

export const agendas: Agenda[] = [
  {
    id: "case-aurora-2026",
    title: "Aurora Strategy Challenge",
    category: "Case Comps",
    scope: "shared",
    urgency: "now",
    countdown: "18h",
    deadline: "2026-08-11T23:59:00+05:30",
    displayDate: "11 Aug · 11:59 PM",
    detail:
      "Submit a 3-slide market entry recommendation and team declaration. The extension applies to all registered teams.",
    source: "Student Affairs · batch announcement",
    confidence: 0.97,
    stages: [
      {
        id: "case-aurora-deck",
        name: "Round 1 deck",
        deadline: "2026-08-11T23:59:00+05:30",
        displayDate: "11 Aug · 11:59 PM",
        status: "in progress",
        note: "Extension confirmed by the 9 Aug announcement.",
      },
      {
        id: "case-aurora-finals",
        name: "Campus finals",
        deadline: "2026-08-17T17:30:00+05:30",
        displayDate: "17 Aug · 5:30 PM",
        status: "to-do",
        note: "Only for shortlisted teams; venue will be shared later.",
      },
    ],
  },
  {
    id: "placement-northstar-2026",
    title: "Northstar Consulting · role preference",
    category: "Placements",
    scope: "private",
    urgency: "soon",
    countdown: "2d",
    deadline: "2026-08-13T18:00:00+05:30",
    displayDate: "13 Aug · 6:00 PM",
    detail:
      "Your application is eligible for the final preference form. This item is visible only in your dashboard.",
    source: "Placement Office · personal status",
    confidence: 0.94,
    stages: [
      {
        id: "northstar-preference",
        name: "Role preference form",
        deadline: "2026-08-13T18:00:00+05:30",
        displayDate: "13 Aug · 6:00 PM",
        status: "to-do",
        note: "Private eligibility update; not added to the shared base.",
      },
    ],
  },
  {
    id: "committee-sports-2026",
    title: "Sports Committee selections",
    category: "Committees",
    scope: "shared",
    urgency: "soon",
    countdown: "4d",
    deadline: "2026-08-15T20:00:00+05:30",
    displayDate: "15 Aug · 8:00 PM",
    detail:
      "Complete the interest form before the interaction round. Shortlist documents remain private review items.",
    source: "Sports Committee · approved announcement",
    confidence: 0.96,
    stages: [
      {
        id: "sports-interest",
        name: "Interest form",
        deadline: "2026-08-15T20:00:00+05:30",
        displayDate: "15 Aug · 8:00 PM",
        status: "submitted",
        note: "Marked submitted in this session.",
      },
      {
        id: "sports-interaction",
        name: "Interaction round",
        deadline: "2026-08-19T19:00:00+05:30",
        displayDate: "19 Aug · 7:00 PM",
        status: "to-do",
        note: "Time is confirmed; room is still pending.",
      },
    ],
  },
  {
    id: "academics-analytics-2026",
    title: "Analytics elective · problem set 2",
    category: "Academics",
    scope: "shared",
    urgency: "steady",
    countdown: "8d",
    deadline: "2026-08-19T09:00:00+05:30",
    displayDate: "19 Aug · 9:00 AM",
    detail:
      "Upload one PDF per study group. The canonical date comes from the course-office correction email.",
    source: "Course Office · correction approved",
    confidence: 0.92,
    stages: [
      {
        id: "analytics-ps2",
        name: "Problem set upload",
        deadline: "2026-08-19T09:00:00+05:30",
        displayDate: "19 Aug · 9:00 AM",
        status: "to-do",
        note: "Correction replaced the earlier 18 Aug date.",
      },
    ],
  },
];

export const reviewItems: ReviewItem[] = [
  {
    id: "review-shortlist",
    kind: "Sensitive attachment",
    title: "Shortlist for Venture Capital Practicum",
    received: "Today · 8:42 AM",
    reason: "Roster-like PDF bypassed model extraction and needs your review.",
    proposedDate: "No deadline extracted",
    source: "Open in Gmail",
  },
  {
    id: "review-date",
    kind: "Low confidence · 0.84",
    title: "Cultural Committee volunteer call",
    received: "Yesterday · 9:18 PM",
    reason: "The body says 14 Aug, while the attached DOCX says 16 Aug.",
    proposedDate: "Proposed: 16 Aug · 5:00 PM",
    source: "Open in Gmail",
  },
];

export const moderatorProposals: ModeratorProposal[] = [
  {
    id: "proposal-extension",
    action: "extension",
    title: "Aurora Strategy Challenge",
    match: "Matched stable stage · case-aurora-deck",
    before: "10 Aug · 11:59 PM",
    after: "11 Aug · 11:59 PM",
    source: "13 matching receipts · IIMK domain",
    confidence: 0.97,
  },
  {
    id: "proposal-new",
    action: "new",
    title: "Responsible AI conclave",
    match: "No shared agenda match",
    before: "No shared record",
    after: "Registration · 21 Aug · 6:00 PM",
    source: "8 matching receipts · approved external sender",
    confidence: 0.91,
  },
];
