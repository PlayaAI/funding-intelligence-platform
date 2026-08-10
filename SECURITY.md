# Security Policy

Grant OS handles private operational records, grant research, application planning, evidence, and scoped agent access. Please report security issues privately and avoid placing sensitive details in public GitHub issues.

## Report a vulnerability

Email [team@playa-ai.org](mailto:team@playa-ai.org) with:

- a concise description of the issue;
- the affected route, component, or workflow;
- reproduction steps that do not expose real credentials or private data;
- the potential impact; and
- any suggested mitigation.

Do not include plaintext MCP tokens, Supabase user JWTs, service-role keys, private grant records, or production database exports. Revoke any credential that may have been exposed before sending the report.

## In scope

- Authentication and protected-route bypasses
- Supabase RLS or cross-user data exposure
- MCP token validation, scope, expiry, or revocation failures
- Approval, idempotency, replay, or autonomy-policy bypasses
- Secrets returned in API, MCP, logs, UI, or build output
- Unauthorized grant, application, task, evidence, or knowledge mutations
- External submission or outreach paths reachable without authorization

## Safety expectations

- Use clearly labeled test records and non-production environments whenever possible.
- Do not access or modify data beyond what is needed to demonstrate the issue.
- Do not run denial-of-service, destructive, scraping, outreach, or submission tests against production.
- Do not publish vulnerability details before the maintainers have had a reasonable opportunity to investigate and remediate them.

## Supported version

Security fixes target the current `main` branch and the currently published Grant OS release. Older commits and preview deployments may not receive fixes.
