# Routes Blueprint

## Route Strategy
Use Next.js App Router. Split public website and dashboard routes clearly.

Suggested route groups:

- `/app/(public)` for public website.
- `/app/(auth)` for auth pages.
- `/app/dashboard` for private dashboard.

## Public Website Routes

### `/`
Homepage.

Sections:
- Hero.
- Mission.
- What We Build.
- Featured Projects.
- Community Proof.
- Why It Matters.
- Grant-Ready Proof.
- Team/Network Preview.
- CTA.

### `/projects`
Projects/experiments index.

Shows public projects with filters:
- Status.
- Category.
- Theme.
- Grant relevance.

### `/projects/[slug]`
Project detail / case study page.

Required content:
- Project summary.
- Problem.
- Solution.
- Who it helps.
- How it works.
- Proof items.
- Media/screenshots.
- Grant relevance.
- Next steps.

### `/projects/connect-app`
Can be handled as `/projects/[slug]`, but should have special high-quality content because Connect App is a flagship case study.

Required sections:
- Guided human connection concept.
- Interaction flow.
- Community usage proof.
- Social problem.
- Screenshots/demo.
- Relationship-helper future extension.

### `/workshops`
Workshops and community-building activities.

Sections:
- Workshop list.
- Outputs from workshops.
- Projects launched.
- Photos/videos.
- Lessons learned.

### `/proof`
Public proof/impact page.

Sections:
- Proof categories.
- Featured proof items.
- Metrics.
- Projects launched.
- Workshops completed.
- Apps/demos.
- Documents/best practices.
- Testimonials.

### `/team`
Team/network credibility page.

Sections:
- Core contributors.
- Builders.
- Advisors.
- Collaborators.
- Accurate credentials.

Do not imply formal institutional endorsement unless verified.

### `/contact`
Contact/collaborate page.

Form fields:
- Name.
- Email.
- Organization.
- Interest type.
- Message.

Interest types:
- Funding.
- Partnership.
- Workshop.
- Project collaboration.
- Media.
- Other.

## Auth Routes

### `/login`
Login page.

### `/logout`
Optional route/action.

### `/reset-password`
Optional later.

## Dashboard Routes

### `/dashboard`
Dashboard home.

Widgets:
- Top 3 Focus Grants.
- Upcoming deadlines.
- Active applications.
- Tasks due this week.
- Recently added grants.
- Grants needing review.
- Applications blocked by missing proof/docs.
- AI recommendations.

### `/dashboard/projects`
Project profiles list.

Features:
- Search.
- Filter by status/public visibility.
- Create project.
- Edit project.
- Archive project.

### `/dashboard/projects/new`
Create project form.

### `/dashboard/projects/[id]`
Project detail.

Tabs:
- Overview.
- Proof items.
- Grants/matches.
- Documents.
- AI summaries.
- Public page preview.

### `/dashboard/grants`
Grant tracker list.

Views:
- Table.
- Kanban/status board.
- Deadline list.
- Top 3 view.

Filters:
- Status.
- Deadline.
- Project.
- Funder.
- Fit score.
- Priority.
- Amount.

### `/dashboard/grants/new`
Create grant form.

### `/dashboard/grants/[id]`
Grant detail.

Tabs:
- Summary.
- Requirements.
- Fit Analysis.
- Application Workspace.
- Tasks.
- Documents.
- AI Notes.

Actions:
- Analyze Fit.
- Suggest Proof.
- Create Application.
- Add to Top 3.
- Mark Apply/Watch/Ignore.

### `/dashboard/funders`
Funder intelligence list.

Features:
- Search.
- Filter by giving area.
- Filter by median grant amount.
- Filter by peer funding connection.

### `/dashboard/funders/new`
Create funder form.

### `/dashboard/funders/[id]`
Funder profile.

Tabs:
- Overview.
- Grants.
- Past grantees.
- Peer org connections.
- Contact/key people.
- AI summary.
- Outreach notes.

### `/dashboard/peers`
Peer organizations list.

### `/dashboard/peers/new`
Create peer organization form.

### `/dashboard/peers/[id]`
Peer organization detail.

Tabs:
- Overview.
- Funding history.
- Funders discovered.
- AI pattern analysis.
- Notes.

### `/dashboard/applications`
Applications list.

Views:
- Table.
- Status board.
- Deadline view.

### `/dashboard/applications/[id]`
Application workspace.

Tabs:
- Overview.
- Questions.
- Drafts.
- Required Docs.
- Proof Package.
- Tasks.
- Submission Checklist.

### `/dashboard/tasks`
Task list.

Filters:
- Owner.
- Status.
- Due date.
- Related grant.
- Priority.

### `/dashboard/proof`
Proof item database.

Features:
- Add proof item.
- Filter by project.
- Filter by type.
- Public/private visibility.
- Suggested for grants.

### `/dashboard/proof/new`
Create proof item form.

### `/dashboard/proof/[id]`
Proof item detail/edit.

### `/dashboard/documents`
Document/link library.

V1: store uploaded docs and external URLs.

### `/dashboard/settings`
Settings.

Sections:
- Organization.
- Users/roles.
- AI settings.
- Integrations placeholder.

## API / Server Action Areas

These can be server actions or API routes:

- `createProject`
- `updateProject`
- `archiveProject`
- `createGrant`
- `updateGrant`
- `createFunder`
- `updateFunder`
- `createPeerOrganization`
- `createApplication`
- `updateApplication`
- `createTask`
- `updateTask`
- `createProofItem`
- `updateProofItem`
- `generateGrantSummary`
- `analyzeGrantFit`
- `suggestProofItems`
- `draftApplicationAnswer`

## Route Guarding

- Public routes: no auth.
- Auth routes: no dashboard access required.
- Dashboard routes: authenticated users only.
- Settings/users: admin only.
- AI actions: authenticated users with proper role only.
