# Grant Intelligence Platform Blueprint Pack

## Purpose
This folder contains the source-of-truth implementation blueprints for building a proof-driven public website plus an internal Instrumentl-inspired grant intelligence and application operations platform.

These files are intentionally written for AI builders. Each file can be handed to a specialized AI agent with a narrow task. Agents should not invent a new product direction. They should follow the relevant blueprint and only ask for clarification when a requirement is impossible or contradictory.

## Product Summary
Build two connected layers:

1. **Public Proof Website**
   - A public credibility site that packages the organization/community's proof: projects, workshops, apps, experiments, documents, people, and impact.
   - The public website is proof-driven, not AI-driven.
   - Its job is to help funders, grant reviewers, partners, and collaborators quickly understand why the organization is credible and fundable.

2. **Internal Grant Intelligence Dashboard**
   - A private operating system for grant discovery, funder research, peer organization funding research, project-to-grant matching, application workspace management, proof package generation, task management, and AI-assisted drafting.
   - Inspired by Instrumentl's tracker, opportunity matches, funder matches, task/document workflow, and AI writing support, but customized around this team’s actual workflow.

## Recommended Build Strategy
Use a multi-agent approach:

- **Replit**: fast clickable prototype with mock data.
- **Claude Code / Claude Antigravity**: main implementation, refactoring, production-quality code, Supabase integration.
- **Codex $200 plan**: parallel isolated feature tickets, backend modules, tests, refactors.
- **Gemini Antigravity**: architecture review, UX audit, long-context critique, second-opinion debugging.

## Files in This Pack

| File | Purpose | Best AI Agent |
|---|---|---|
| `PROJECT_BRIEF.md` | High-level context, product vision, what we are building | All agents |
| `PRD.md` | Detailed product requirements and modules | Product/engineering lead |
| `ARCHITECTURE.md` | Technical architecture, stack, folder structure, implementation rules | Engineering lead |
| `DATABASE_SCHEMA.md` | Tables, fields, relationships, enums, indexes, RLS notes | Backend/database agent |
| `ROUTES.md` | Public and dashboard route map | Frontend agent |
| `USER_ROLES.md` | Roles, permissions, access control | Backend/auth agent |
| `FEATURE_PHASES.md` | Phased build plan and scope boundaries | Product/project manager agent |
| `AI_WORKFLOWS.md` | AI features, prompts, structured outputs, human-in-the-loop rules | AI workflow agent |
| `DESIGN_SYSTEM.md` | Visual direction, components, dashboard UX rules | UI/UX agent |
| `QA_CHECKLIST.md` | Testing checklist, acceptance criteria, regression scenarios | QA agent |
| `DATA_INGESTION.md` | Manual imports, CSV/PDF/URL ingestion, future 990/funder data | Data ingestion agent |
| `AGENT_BUILD_STRATEGY.md` | How to divide work across AI tools/agents | Build orchestrator |
| `SEED_DATA.md` | Initial sample data for MVP/demo | Frontend/backend agents |
| `MVP_SCOPE.md` | Exactly what to build first and what not to build yet | All agents |

## Non-Negotiable Product Rules

1. The public website is **proof-driven**, not a generic AI startup site.
2. AI should primarily support the internal dashboard: research, scoring, summarization, drafting, and proof matching.
3. The internal dashboard should help the team answer: **Which grants should we apply for, why are we a strong fit, what proof do we have, and what needs to happen before submission?**
4. Do not build a full document editor in V1. Use Google Doc and Google Drive links.
5. Do not build complex 990 parsing, Google Drive API integration, or full scraping in V1.
6. Do not let AI auto-submit grants, auto-email funders, or make irreversible changes. Keep humans in the loop.
7. Keep the first version simple, clean, useful, and aligned to the real meeting workflow.
