# Kampus Command Center Design

## Goal

Replace Kampus's soft editorial dashboard styling with an energetic, modern productivity interface. The redesign must make a student's next action obvious while preserving every existing task, Gmail, Ask Kampus, moderator, privacy, and Supabase behaviour.

## Visual system

- **Base:** deep navy application shell with bright white content surfaces.
- **Action:** electric blue is reserved for primary actions and interactive focus.
- **State:** lime indicates completed or on-track work; coral marks urgent deadlines and destructive actions; category colours remain stable throughout the interface.
- **Typography:** a clean sans-serif carries all product UI. The existing brand mark may retain a small expressive treatment, but large editorial serif headings are removed.
- **Motion:** feedback is quick and restrained: status fades, task completion settles, and drawers slide. Respect reduced-motion preferences.

## Layout

### Desktop

- A compact navigation rail provides Dashboard, categories, Ask Kampus, Gmail connection state, and account controls.
- The main canvas opens with an **Up next** strip: deadline title, category, countdown, and a direct manage action.
- Category tabs and filters sit immediately below it.
- The deadline feed is a dense list of rows rather than a page of raised cards. Each row shows a date badge, task title, category, status/progress, and one expand control.
- Manual private-deadline entry remains an expandable panel. It is visually secondary to the deadline feed.

### Mobile

- The main canvas stays single-column and begins with Up next.
- Navigation becomes a bottom bar with a prominent quick-add control.
- Category tabs remain horizontally scrollable and keyboard-accessible.
- The Ask Kampus experience remains a full-screen sheet.

## Components and interaction

- **Deadline urgency:** only the most immediate task receives high visual emphasis. Other dates rely on compact badges and predictable colour cues.
- **Task management:** expanded controls preserve the current progress, private-date, category, and delete behaviour. The visual grouping changes; route and permission rules do not.
- **Feedback:** current optimistic updates remain. Each save, delete, sync, or error uses a visible inline state rather than a page reload.
- **Ask Kampus:** becomes a clearly named utility in navigation and a drawer/sheet when opened. It remains read-only and does not persist chat content.
- **Login:** receives the same product colour and typography system but keeps the existing Google-only IIMK admission and optional, separate Gmail connection explanation.

## Accessibility and performance

- Preserve semantic controls, focus trapping/restoration in dialogs and drawers, keyboard category navigation, and reduced-motion support.
- Maintain at least 14px button text and WCAG AA contrast for text and state colour combinations.
- Do not add heavy illustration, video, or animation bundles. Ask Kampus remains dynamically loaded on demand.

## Explicitly unchanged

- Supabase schema, migrations, RLS, API contracts, Gmail scopes and sync behaviour.
- Google-only login and IIMK domain restriction.
- Moderator roles, permissions, and approval flows.
- Ask Kampus read-only retrieval, limits, sources, and privacy protections.
- Existing no-reload dashboard state updates.

## Acceptance checks

- A student can identify the next deadline and create a private one without searching the screen.
- Category, urgency, progress, and completion can be scanned quickly at desktop and 390px mobile widths.
- Existing task, Gmail, moderator, and Ask Kampus tests continue to pass.
- No new reload is introduced for task or sync operations.
- Keyboard navigation, dialog focus behaviour, colour contrast, and reduced motion remain supported.
