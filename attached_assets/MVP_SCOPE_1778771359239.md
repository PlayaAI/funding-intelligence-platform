# MVP Scope

## MVP Goal
Create a useful first version that supports the real workflow from the meeting without overbuilding.

The MVP should prove:

1. The public website can package proof clearly.
2. The internal dashboard can track grants and projects.
3. The team can prepare one application using a structured workspace.
4. The platform can support Top 3 grant prioritization.
5. AI can assist with summaries, fit analysis, drafting, and proof suggestions.

## MVP Includes

## Public Website MVP

### Pages
- Home.
- Projects.
- Project detail.
- Connect App case study.
- Workshops.
- Proof / Impact.
- Team.
- Contact.

### Content Requirements
- Use meeting-specific project examples.
- Make Connect App a flagship case study.
- Show proof types even if some are placeholders.
- Avoid claiming unverified metrics.
- Avoid generic AI startup positioning.

## Internal Dashboard MVP

### Core Pages
- Login.
- Dashboard home.
- Projects.
- Grants.
- Grant detail.
- Funders.
- Peer organizations.
- Applications.
- Application detail/workspace.
- Tasks.
- Proof items.
- Documents/links.

### Core Features
- Basic auth.
- CRUD for core records.
- Link grants to funders and projects.
- Link proof items to projects.
- Link proof items to applications.
- Store Google Doc and Drive links.
- Top 3 Focus Grants.
- Status tracking.
- Deadline sorting.
- Task assignment.

## AI MVP

### Required AI Actions
- Summarize Grant.
- Analyze Grant Fit.
- Draft Application Answer.
- Suggest Proof Items.

### AI Requirements
- Human review required.
- Save AI outputs.
- Do not invent facts.
- Flag missing data.
- Do not auto-submit or externally send anything.

## Data MVP

### Required
- Manual entry.
- Seed data.
- Optional CSV import if time allows.
- Document/external link storage.

### Not Required
- Full scraping.
- Full 990 parser.
- Full Google Drive API integration.
- Automated grant portal submission.

## What Not To Build in MVP

- Full Instrumentl clone.
- Billing/subscriptions.
- Multi-tenant SaaS onboarding.
- Complex CRM.
- Full donor management.
- Post-award reporting.
- Full Google Docs editor.
- Automatic email outreach.
- Agent that changes data without approval.
- Complex data visualizations.

## MVP Acceptance Criteria

### Public Site
- A funder can understand what the group is and what proof exists.
- Connect App is understandable and credible.
- Proof page makes work feel real, not theoretical.

### Dashboard
- User can create and manage projects, grants, funders, applications, tasks, and proof items.
- User can mark Top 3 Focus Grants.
- User can create an application workspace and link Google Docs/Drive.
- User can link proof items to application.

### AI
- User can generate a grant summary.
- User can generate fit analysis.
- User can generate a draft answer.
- User can get proof suggestions.
- AI outputs are saved and reviewable.

## MVP Demo Scenario

Use this scenario to test the MVP:

1. Admin logs in.
2. Creates or views Connect App project.
3. Adds proof items: field test, workshop, screenshot, testimonial placeholder.
4. Creates MIT Solve grant.
5. Links grant to MIT Solve funder.
6. Runs AI fit analysis for Connect App.
7. Marks MIT Solve as Top 3 Priority.
8. Creates application workspace.
9. Adds Google Doc and Drive links.
10. Adds application questions.
11. Drafts one answer using AI.
12. Suggests proof items.
13. Assigns tasks to team members.
14. Public website displays Connect App case study and proof page.

If this flow works, MVP is successful.
