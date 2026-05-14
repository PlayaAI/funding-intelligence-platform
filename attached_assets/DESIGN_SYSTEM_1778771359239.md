# Design System Blueprint

## Product Design Direction
The product should feel like a calm, premium, credible mission-control system for grant-funded projects.

It should not feel like:
- Generic AI startup landing page.
- Cheap nonprofit template.
- Overcomplicated enterprise software.
- Cluttered CRM.
- Toy prototype.
- Random dashboard kit.

## Public Website Visual Direction

### Keywords
- Proof-driven.
- Human.
- Credible.
- Community-centered.
- Editorial.
- Clean.
- Modern.
- Warm but not cheesy.
- Grant-reviewer friendly.

### Public Site Tone
The public website should make the work legible and fundable.

It should say:
- We have real projects.
- We have real people.
- We have real community activity.
- We have proof.
- We are ready for funding.

### Public Site Layout Principles
- Strong hero with simple mission.
- Use case-study cards for projects.
- Use proof blocks instead of long generic paragraphs.
- Use metrics and proof items where available.
- Use visual hierarchy to guide funders quickly.
- Avoid overclaiming.

## Dashboard Visual Direction

### Keywords
- Mission control.
- Focused.
- Calm.
- Operational.
- Prioritized.
- Trustworthy.
- Lightweight.

### Dashboard UX Priorities
- Make top priorities obvious.
- Make deadlines obvious.
- Make blocked applications obvious.
- Make next actions obvious.
- Do not bury key info in deep menus.

## Colors
Use a restrained palette.

Suggested:
- Background: near-white or soft off-white.
- Text: deep charcoal.
- Accent: deep blue, violet, or teal.
- Success: muted green.
- Warning: amber.
- Danger: muted red.
- Cards: white with subtle border.

Avoid neon AI gradients unless used very subtly.

## Typography
- Use a modern sans-serif font.
- Prioritize readability.
- Dashboard numbers and labels must be clear.
- Public site can use stronger editorial headings.

## Component System
Use shadcn/ui where possible.

### Core Components
- Button.
- Card.
- Badge.
- Input.
- Textarea.
- Select.
- Tabs.
- Dialog.
- Sheet.
- Table.
- Dropdown menu.
- Toast.
- Alert.
- Progress.
- Skeleton.

## Dashboard Components

### DashboardStatCard
Shows a key number or state.

Examples:
- Top 3 Focus Grants.
- Applications in Drafting.
- Deadlines in 14 Days.
- Tasks Due This Week.

### GrantCard
Fields:
- Grant title.
- Funder.
- Deadline.
- Status.
- Fit score.
- Priority score.
- Related project.
- Next action.

### ProjectCard
Fields:
- Project name.
- Summary.
- Status.
- Proof count.
- Public/private badge.
- Related grants count.

### FunderCard
Fields:
- Name.
- Giving area.
- Median grant amount.
- Peer connections.
- Relationship status.

### ProofItemCard
Fields:
- Type badge.
- Title.
- Related project.
- Public/private.
- Grant relevance.

### ApplicationWorkspaceHeader
Fields:
- Grant title.
- Project.
- Deadline.
- Status.
- Owner.
- Google Doc link.
- Drive folder link.

## Empty States
Every empty state should explain the feature and suggest the next action.

Example:

> No grants added yet. Add your first grant opportunity or import a CSV to start building your tracker.

## AI UI Rules

AI buttons should be explicit:
- Summarize Grant.
- Analyze Fit.
- Suggest Proof.
- Draft Answer.

AI output cards should show:
- Generated timestamp.
- Model if available.
- Confidence/caveat section.
- Save/apply button where relevant.
- “Verify before using” notice.

## Public Website Content Components

### Hero
- Short mission headline.
- Supporting text.
- Primary CTA.
- Secondary CTA.

### Featured Project Card
- Project name.
- One-line summary.
- Proof/traction note.
- CTA.

### Proof Strip
- Number/stat.
- Label.
- Small explanation.

### Case Study Block
- Problem.
- Solution.
- Proof.
- Next step.

### Workshop Card
- Title.
- Date.
- Output.
- People/projects involved.

## Responsive Rules
- Public website must look excellent on mobile.
- Dashboard should be usable on mobile but optimized for desktop/tablet.
- Tables should collapse into cards on small screens.

## Accessibility
- Use semantic HTML.
- Maintain color contrast.
- All buttons/links keyboard accessible.
- Forms must have labels.
- Use clear focus states.

## Copy Style

### Public Site Copy
- Clear.
- Credible.
- Specific.
- Human.
- Not inflated.

Avoid:
- “Revolutionary.”
- “Changing the world.”
- “AI-powered everything.”
- Fake metrics.
- Claims of formal partnerships without proof.

### Dashboard Copy
- Direct.
- Operational.
- Action-oriented.

Examples:
- “3 grants need review.”
- “MIT Solve draft is missing proof items.”
- “Add Google Doc.”
- “Suggest proof.”
