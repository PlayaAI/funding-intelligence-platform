# Product Requirements Document

## Product Name
Working title: Grant Intelligence Platform

## Product Type
Hybrid public website + private SaaS-style dashboard.

## Vision
Build a proof-driven public website and private grant intelligence dashboard that helps the team package credibility, discover high-fit grants, research funders, collaborate on applications, and use AI to prepare stronger proposals.

## Problem Statement
The team has meaningful proof and projects but lacks a system for organizing them into grant-ready evidence. Grant applications are currently vulnerable to last-minute chaos, scattered documents, unclear ownership, deadline pressure, and repeated rewriting of the same project language.

## Goals

### Public Website Goals
- Explain the organization/community clearly.
- Show projects, workshops, apps, and proof.
- Make the team look credible to grant reviewers and funders.
- Create strong case-study pages for high-priority projects, especially Connect App.
- Convert visitors into funders, collaborators, workshop participants, or partners.

### Internal Dashboard Goals
- Track grant opportunities and deadlines.
- Match grants to project profiles.
- Maintain funder profiles and peer organization research.
- Build application workspaces using Google Docs/Drive links.
- Assign tasks and owners.
- Generate proof packages.
- Use AI to summarize, score, draft, and suggest improvements.
- Keep humans in control of final submissions.

## Non-Goals for V1
- Do not build a full Instrumentl clone.
- Do not build a full word processor.
- Do not integrate deeply with Google Drive API yet.
- Do not build automatic submission to grant portals.
- Do not build a full donor CRM.
- Do not build complex 990 extraction in MVP.
- Do not build autonomous external communication.

## User Personas

### 1. Grant Strategy Lead
Needs to see top opportunities, decide which grants to pursue, assign tasks, and track progress.

### 2. Grant Researcher
Needs to add funders, research peer organizations, compare opportunities, gather requirements, and organize docs.

### 3. Project Contributor
Needs to add project descriptions, proof items, screenshots, event notes, metrics, and reusable language.

### 4. Application Writer
Needs application questions, draft answers, proof suggestions, word limits, review status, and Google Doc links.

### 5. Reviewer/Advisor
Needs read access and commenting/review visibility, not broad editing control.

### 6. Public Funder/Partner Visitor
Needs a clear, credible public site showing proof, impact, people, and projects.

## Core Modules

## 1. Public Proof Website

### Required Pages
- Home
- Projects / Experiments
- Project Detail / Case Study
- Connect App Case Study
- Workshops
- Proof / Impact
- Team / Network
- Contact / Collaborate

### Homepage Requirements
The homepage should include:

- Hero with clear mission.
- What We Build section.
- Featured projects.
- Community proof.
- Why it matters.
- Grant-ready proof.
- Team/network credibility.
- CTA to collaborate, fund, partner, or join.

### Projects Page Requirements
Each project card must show:

- Project name.
- Short summary.
- Status.
- Category.
- Who it helps.
- Grant relevance.
- Link to case study.

### Connect App Page Requirements
Must explain:

- What the Connect App is.
- How the guided interaction works.
- The social problem it addresses.
- Why it matters for human connection.
- Usage/session proof when available.
- Screenshots/demo media.
- Next evolution: connection + relationship maintenance.

### Proof / Impact Page Requirements
Must include:

- Workshops completed.
- Projects launched.
- Apps/demos created.
- Documents produced.
- Best practices.
- Testimonials.
- Screenshots/videos.
- Metrics.
- Community activity.

## 2. Internal Dashboard Home

### Required Widgets
- Top 3 Focus Grants.
- Upcoming deadlines.
- Active applications.
- Tasks due this week.
- Recently added opportunities.
- Grants needing review.
- Applications blocked by missing documents/proof.
- AI recommendation cards.

### Primary Dashboard Question
“What should we focus on this week?”

## 3. Project Profiles

### Required Fields
- Name.
- Slug.
- Summary.
- Problem statement.
- Solution.
- Target audience.
- Geography.
- Stage.
- Technology involved.
- Social/environmental impact.
- Team members.
- Existing proof.
- Media links.
- Reusable grant language.
- Related documents.
- Related funders.
- Related grants.
- Public visibility toggle.

### Required Actions
- Create project.
- Edit project.
- Archive project.
- Mark as public/private.
- Link proof items.
- Link grants.
- Generate AI project summary.

## 4. Grant Opportunity Tracker

### Required Fields
- Grant title.
- Funder.
- Deadline.
- Amount minimum.
- Amount maximum.
- Focus areas.
- Geography.
- Eligibility.
- Application URL.
- Source URL.
- Required documents.
- Application questions.
- Notes.
- Status.
- Assigned owner.
- Related project.
- Fit score.
- Priority score.
- Urgency score.
- Difficulty score.
- Submission status.

### Required Views
- Table view.
- Card/Kanban view by status.
- Calendar/deadline view later.
- Top 3 focus view.

### Required Filters
- Status.
- Deadline range.
- Funder.
- Project.
- Fit score.
- Priority score.
- Amount.
- Focus area.

### Statuses
- Discovered
- Needs Review
- Shortlisted
- Top 3 Priority
- Preparing
- Drafting
- Internal Review
- Ready to Submit
- Submitted
- Won
- Rejected
- Archived

## 5. Grant Detail Page

### Required Sections
- Summary.
- Eligibility.
- Fit analysis.
- Requirements.
- Application workspace.
- Tasks.
- Documents.
- AI notes.
- Decision: Apply / Watch / Ignore.

### Required Actions
- Edit grant.
- Assign project.
- Assign owner.
- Create application workspace.
- Add Google Doc link.
- Add Google Drive folder link.
- Generate AI summary.
- Generate fit score.
- Suggest proof items.
- Move status.

## 6. Funder Intelligence

### Required Fields
- Name.
- EIN.
- Website.
- Location.
- Total assets.
- Annual giving.
- Median grant amount.
- Past grantees.
- Giving categories.
- Contact people.
- Board/key people.
- Open application status.
- Relationship notes.
- Similar funders.
- Best matching projects.
- Outreach strategy.

### Required Actions
- Add funder.
- Edit funder.
- Link funder to grants.
- Link funder to peer funding records.
- AI summarize funder.
- AI suggest best project angle.

## 7. Peer Organization Research

### Required Fields
- Organization name.
- EIN.
- Website.
- Description.
- Notes.
- Funding records.

### Required Funding Record Fields
- Funder.
- Year.
- Amount.
- Source URL.
- Notes.

### Required Actions
- Add peer org.
- Add funding record.
- Link funders.
- AI summarize funder patterns.
- AI recommend funders to pursue.

## 8. Application Workspace

### Required Fields
- Grant.
- Project.
- Owner.
- Status.
- Google Doc URL.
- Google Drive folder URL.
- Portal URL.
- Submission deadline.
- Submitted date.
- Result.
- Internal notes.

### Required Sections
- Application questions.
- Draft answers.
- Final answers.
- Word limits.
- Owners.
- Review status.
- Required docs checklist.
- Tasks.
- Proof suggestions.

### Required Workflow
- Create workspace from grant.
- Add form questions manually or by AI extraction.
- Draft answers in platform or Google Doc.
- Assign questions to owners.
- Review answers.
- Mark ready to submit.
- Mark submitted.

## 9. Proof Package Builder

### Required Proof Item Types
- Workshop.
- Event.
- App/demo.
- Screenshot.
- Testimonial.
- Metric.
- Document.
- Case study.
- Video.
- Media mention.
- Team credential.
- Partner/collaborator.
- Community output.

### Required Fields
- Title.
- Type.
- Description.
- Related project.
- Date.
- Media URL.
- Document URL.
- Metrics.
- Tags.
- Grant relevance.
- Public visibility.
- Suggested language.

### Required Actions
- Add proof item.
- Link to project.
- Mark public/private.
- Suggest for grant.
- Generate proof summary.

## 10. Task Management

### Required Fields
- Title.
- Description.
- Owner.
- Related grant.
- Related project.
- Related application.
- Due date.
- Status.
- Priority.

### Task Statuses
- Not Started
- In Progress
- Waiting
- Needs Review
- Complete

## 11. AI Assistant

### Required V1 Actions
- Summarize grant.
- Analyze fit.
- Draft application answer.
- Suggest proof items.

### V2 Actions
- Extract questions from grant page/PDF.
- Summarize funder.
- Analyze peer funding pattern.
- Recommend top 3 grants.
- Create weekly readiness report.

## Success Metrics

### MVP Success
- Team can add projects, grants, funders, proof items, applications, and tasks.
- Team can see top 3 grants and upcoming deadlines.
- Public proof website clearly presents the organization and proof.
- One grant application can be prepared end-to-end using the dashboard + Google Doc link.

### Longer-Term Success
- Team consistently applies earlier.
- Team uses reusable proof instead of rewriting from scratch.
- Funders and peer orgs are mapped into a searchable intelligence layer.
- AI saves time without removing human review.
