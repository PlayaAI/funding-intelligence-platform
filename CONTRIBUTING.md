# Contributing to Grant OS

Thank you for helping improve Grant OS. The project prioritizes trustworthy grant operations, evidence quality, least-privilege agent access, and clear operator readbacks.

## Before you begin

- Open or reference an issue for material product, schema, security, or workflow changes.
- Keep changes inside `artifacts/grant-os` unless the workspace configuration or documentation must change.
- Do not commit credentials, private grant data, imported archives, generated exports, or production environment files.
- Do not weaken Supabase RLS, token validation, approval gates, autonomy limits, or claim-safety rules.
- Do not add application submission, funder outreach, hard deletion, arbitrary SQL, or service-role access to browser or agent surfaces.

## Development workflow

1. Create a focused branch from current `main`.
2. Inspect the working tree before editing.
3. Make the smallest coherent change.
4. Add or update tests for changed behavior.
5. Run the relevant validation commands from [README.md](README.md).
6. Run `git diff --check` and inspect the final diff.
7. Open a pull request describing behavior, safety impact, validation results, migrations, deployment steps, and remaining risks.

## Database changes

- Prefer additive, forward-fix migrations.
- Document migration order and rollback implications.
- Validate RLS and cross-role behavior explicitly.
- Never hard-delete production data as part of a migration or cleanup.
- Use preview-first cleanup scripts and archive or soft-hide records when possible.

## Agent and MCP changes

Every write-capable tool should:

- validate structured input;
- enforce explicit scopes and field allowlists;
- default to dry-run where applicable;
- produce planned or applied mutations and affected record IDs;
- prevent replay and unsafe duplicate creation;
- emit audit metadata without secrets; and
- preserve the block on deletion, submission, outreach, arbitrary policy changes, and direct approval of unverified claims.

## Pull-request checklist

- [ ] The diff is scoped and contains no unrelated changes.
- [ ] No credential, token, private data, or prompt residue is present.
- [ ] Typecheck and production build pass.
- [ ] Relevant simulations pass without touching production data.
- [ ] Schema and RLS changes, if any, are documented and reviewed.
- [ ] UI errors explain the next operator action.
- [ ] Deployment and rollback steps are included.

For sensitive security findings, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
