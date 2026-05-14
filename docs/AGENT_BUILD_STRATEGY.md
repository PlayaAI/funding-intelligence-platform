# AI Agent Build Strategy

## Goal
Use multiple AI coding tools without letting them create conflicting versions of the product.

## Recommended Tool Roles

## Replit
Best for:
- Fast MVP shell.
- Clickable prototype.
- Mock data.
- Public pages and dashboard layout.

Do not use Replit as the sole long-term architect unless the product remains very simple.

## Claude Code / Claude Antigravity
Best for:
- Main implementation.
- Multi-file codebase work.
- Supabase integration.
- TypeScript cleanup.
- Refactoring.
- Bug fixing.
- Production-quality code.

Use Claude as the main finisher.

## Codex $200 Plan
Best for:
- Parallel isolated tickets.
- Backend modules.
- CRUD features.
- Refactors.
- Tests.
- Schema work.
- Import tools.

Give Codex small tasks, not vague full-product instructions.

## Gemini Antigravity
Best for:
- Architecture review.
- UX critique.
- Long-context analysis.
- Product gap finding.
- QA second opinion.
- Prompt improvement.

Use Gemini as reviewer and strategist.

## Recommended Workflow

### Step 1: Blueprint Pack
Use this folder as the source of truth.

### Step 2: Prototype
Give Replit a strict MVP prompt:
- Build public proof website + dashboard shell.
- Use mock data.
- Do not build complex backend.
- Follow routes and design system.

### Step 3: GitHub Repo
Move code to GitHub.

### Step 4: Production Setup
Use Claude to:
- Clean architecture.
- Add Supabase.
- Add auth.
- Add database types.
- Prepare reusable components.

### Step 5: Parallel Tickets
Use Codex to implement independent modules:
- Projects CRUD.
- Grants CRUD.
- Funders CRUD.
- Applications workspace.
- Tasks.
- Proof items.
- AI service layer.
- CSV import.

### Step 6: Review
Use Gemini to audit:
- Does it match blueprints?
- Is it overbuilt?
- Is anything missing?
- Are there UX gaps?
- Are roles/security clear?

### Step 7: Fix + Polish
Use Claude/Codex to fix issues from review.

## Ticket Template for AI Coding Agents

```md
# Ticket: [Feature Name]

## Context
This project is a proof-driven public website plus internal grant intelligence dashboard. Follow the blueprint files in `/docs`.

## Goal
[Clear goal]

## Scope
Build only:
- [Item]
- [Item]

Do not build:
- [Out of scope]

## Relevant Files
- [Blueprint file]
- [Existing code files]

## Requirements
- [Requirement]
- [Requirement]

## Acceptance Criteria
- [Criteria]
- [Criteria]

## Rules
- Do not change unrelated modules.
- Keep TypeScript strict.
- Use existing components where possible.
- Add loading/error/empty states.
- Ask before changing architecture.
```

## Agent Separation

### Product Architect Agent
Reads:
- PROJECT_BRIEF.md
- PRD.md
- MVP_SCOPE.md
- FEATURE_PHASES.md

Outputs:
- refined tickets.
- user stories.
- acceptance criteria.

### UI/UX Agent
Reads:
- DESIGN_SYSTEM.md
- ROUTES.md
- PROJECT_BRIEF.md

Outputs:
- layouts.
- components.
- UX improvements.

### Backend Agent
Reads:
- DATABASE_SCHEMA.md
- USER_ROLES.md
- ARCHITECTURE.md

Outputs:
- migrations.
- server actions.
- auth/permissions.

### Frontend Agent
Reads:
- ROUTES.md
- DESIGN_SYSTEM.md
- PRD.md

Outputs:
- pages.
- forms.
- tables.
- dashboard UI.

### AI Workflow Agent
Reads:
- AI_WORKFLOWS.md
- DATABASE_SCHEMA.md
- PRD.md

Outputs:
- AI service.
- prompts.
- structured outputs.
- AI UI actions.

### Data Ingestion Agent
Reads:
- DATA_INGESTION.md
- DATABASE_SCHEMA.md

Outputs:
- CSV import.
- upload/link handling.
- extraction workflow.

### QA Agent
Reads:
- QA_CHECKLIST.md
- all relevant module docs.

Outputs:
- bug report.
- regression checklist.
- fix prompts.

## Golden Rule
Every AI agent should build from the blueprint, not from imagination.
