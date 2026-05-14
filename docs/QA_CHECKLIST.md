# QA Checklist

## Purpose
Use this checklist after each build phase. AI agents should run through this before claiming a task is complete.

## Global QA

### App Health
- App starts locally without errors.
- TypeScript passes.
- Lint passes if configured.
- No console errors on main pages.
- No broken imports.
- No missing environment variable crashes without helpful error.

### Navigation
- Public navigation works.
- Dashboard navigation works.
- Active nav states work.
- Broken links are fixed or removed.
- External links open safely.

### Responsiveness
- Public site works on mobile, tablet, desktop.
- Dashboard works acceptably on mobile and well on desktop.
- Tables do not break layout on small screens.

### Accessibility
- Forms have labels.
- Buttons have accessible names.
- Keyboard navigation works for key flows.
- Color contrast is acceptable.

## Public Website QA

### Homepage
- Mission is clear within 10 seconds.
- It does not present the website as generic “AI-driven.”
- It shows proof, projects, and credibility.
- Featured projects appear.
- CTA works.

### Projects Page
- Project cards render correctly.
- Public/private filtering is respected.
- Each project links to detail page.

### Connect App Page
- Explains what the app is.
- Explains how the guided connection works.
- Shows proof/usage placeholders if real metrics are unavailable.
- Does not overclaim metrics.

### Workshops Page
- Shows workshops or a meaningful empty state.
- Shows outputs/projects from workshops.

### Proof Page
- Shows proof items by type.
- Does not expose private proof.
- Public proof items link to related projects where applicable.

### Team Page
- Credentials are accurate.
- No implied formal endorsement unless verified.

### Contact Page
- Form validates required fields.
- Form success/error states work.

## Auth QA

- Unauthenticated users cannot access `/dashboard` routes.
- Authenticated users can access allowed routes.
- Role restrictions work.
- Logout works.
- Auth errors are understandable.

## Dashboard QA

### Dashboard Home
- Shows Top 3 Focus Grants.
- Shows upcoming deadlines.
- Shows tasks due this week.
- Shows active applications.
- Empty states appear when no data exists.

### Projects
- Create project works.
- Edit project works.
- Archive project works.
- Public visibility toggle works.
- Project detail shows proof and grants.

### Grants
- Create grant works.
- Edit grant works.
- Status changes work.
- Deadline sorting works.
- Filters work.
- Grant detail shows summary/eligibility/workspace/tasks.
- Grant can be linked to funder/project.

### Funders
- Create funder works.
- Edit funder works.
- Funder detail shows grants and peer funding records.
- Missing data is handled gracefully.

### Peer Organizations
- Create peer organization works.
- Add funding records works.
- Peer detail shows funder history.

### Applications
- Create application from grant works.
- Application can store Google Doc URL.
- Application can store Drive folder URL.
- Questions can be added.
- Draft/final answers can be saved.
- Required docs checklist works.
- Proof items can be linked.

### Tasks
- Create task works.
- Assign owner works.
- Link to grant/project/application works.
- Status and priority update works.
- Due date sorting works.

### Proof Items
- Create proof item works.
- Link to project works.
- Public visibility works.
- Public site only shows public items.

## AI Workflow QA

### General
- AI buttons show loading states.
- AI errors are handled.
- AI output is saved to `ai_outputs`.
- AI output is reviewable before applying.
- AI never auto-submits anything.

### Grant Summary
- Uses grant data.
- Lists requirements and risks.
- Does not invent missing information.

### Fit Analysis
- Uses project + grant data.
- Returns fit, priority, urgency, difficulty scores.
- Gives reasons and concerns.
- Recommends apply/watch/ignore/needs research.

### Draft Answer
- Uses project profile and proof items.
- Respects word limit where possible.
- Flags claims to verify.
- Does not invent fake metrics.

### Proof Suggestions
- Suggests relevant proof items.
- Explains where to use each proof item.
- Lists missing evidence.

## Data Integrity QA

- Deleting/archiving a record does not break related pages.
- Required foreign keys are enforced.
- Empty relationships show helpful states.
- Timestamps update properly.
- Public visibility is respected.

## Security QA

- Dashboard data is not visible publicly.
- Private document links are not rendered on public pages.
- AI API keys are not exposed client-side.
- Role-restricted actions are protected server-side, not only in UI.

## Acceptance Criteria Before MVP Launch

- Public site pages are complete enough to show to a funder.
- Dashboard can manage projects, grants, funders, applications, tasks, proof items.
- One complete grant application workflow can be simulated.
- Top 3 grants feature works.
- Google Doc/Drive link workflow works.
- AI MVP actions work or are clearly marked as not connected yet.
- No critical security leaks.
