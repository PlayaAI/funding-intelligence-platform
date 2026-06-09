# Grant OS Agent Workflows

Grant OS V2.0 treats the dashboard as both:

1. a human operations/showcase interface
2. a controlled internal data layer that AI agents can use through explicit tools

This document defines *workflow blueprints*, not full autonomy. Any risky or external action must stop at a human approval gate.

## Safety rules

- No external application submission
- No funder outreach without explicit approval
- No destructive record deletion through agent tools
- No RLS/policy changes through agent tools
- No public-site mutation without approval
- No service-role secrets in frontend code
- No bulk imports/scraping from this workflow layer yet
- Safe write tools must support `dryRun: true`

---

## Workflow 1 — Continuous Grant Discovery

Future flow:

1. Run approved import/scraper job
2. Normalize grants, funders, and documents
3. Detect newly added or materially changed opportunities
4. Expose candidate grants via `list_grants`, `search_grants`, and reports
5. Compare to existing projects using current stored metadata only
6. Create shortlist candidates with `save_grant_to_shortlist` in dry-run first
7. Present human review summary
8. Wait for approval before any broader ingestion actions

Human approval gate:

- approve shortlist entries
- approve any import/scrape job
- approve any external follow-up

---

## Workflow 2 — Application Preparation

Future flow:

1. Pick an approved grant
2. Inspect grant packet with `get_grant`, `get_grant_documents`, `export_grant_packet`
3. Inspect candidate project and proof with `get_project`, `get_proof_items_for_project`
4. Create application workspace with `create_application_from_grant` (`dryRun: true` first)
5. Generate internal checklist with `generate_application_checklist`
6. Inspect required docs/questions
7. Suggest proof items and drafting priorities
8. Add internal notes with `add_application_note`
9. Mark human review needed

Human approval gate:

- approve final application strategy
- approve any external portal action
- approve final submission outside Grant OS

---

## Workflow 3 — Deadline Monitoring

Future flow:

1. Scan active grants and applications
2. Run `get_deadline_report`
3. Run `get_application_workload_report`
4. Identify deadlines within 30 / 14 / 7 / 3 day windows
5. Identify incomplete or unowned tasks
6. Create reminder tasks with `create_task` or update existing tasks safely
7. Present summary to humans

Human approval gate:

- approve any outbound reminder or external message
- approve any broad bulk status edits

---

## Workflow 4 — Peer / Funder Research

Future flow:

1. Inspect peer orgs via `list_peers`, `get_peer`, `get_peer_funding_records`
2. Inspect funders via `list_funders`, `get_funder`, `get_funder_grants`
3. Add verified peer organizations and funding records with dry-run first
4. Export peer/funder packets for internal review
5. Suggest potential relationships or research next steps

Human approval gate:

- approve external outreach
- approve any public claims derived from peer research
- approve higher-risk research ingestion actions

---

## Workflow 5 — Human Approval Gate

Any risky action must stop and return a structured proposal:

- proposed action
- reason
- affected records
- rollback plan
- approval required

Examples:

- archive records
- delete records
- bulk update records
- send outreach
- submit applications externally
- run imports
- run scraping jobs
- mutate public website content
- change RLS/policies

Expected response shape:

```json
{
  "requires_approval": true,
  "proposed_action": {
    "tool_name": "archive_record",
    "reason": "archive stale duplicate",
    "affected_records": [{ "table": "grants", "id": "grant-123" }],
    "proposed_mutation": { "action": "archive", "recordType": "grant", "recordId": "grant-123" },
    "rollback_plan": "No automatic rollback implemented. Review payload and execute manually after approval."
  }
}
```

---

## What this phase enables now

- Safe internal read access through explicit tools
- Dry-run planning for safe writes
- Non-destructive creation of internal application/task/note/peer records
- Structured approval payloads for risky actions
- Audit payload generation for tool runs

## What this phase does *not* enable yet

- autonomous external submissions
- autonomous outreach
- autonomous scraping/import execution
- destructive data mutation
- policy/RLS changes
- fully autonomous grant operations
