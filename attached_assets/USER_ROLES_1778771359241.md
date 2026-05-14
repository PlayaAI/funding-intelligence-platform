# User Roles and Permissions

## Purpose
Define who can access and modify each area of the platform.

## Roles

## 1. Admin
Full access.

Can:
- Manage organization settings.
- Manage users and roles.
- Create/edit/delete/archive all records.
- Run AI workflows.
- View all private notes and documents.
- Manage public visibility.
- Deploy/configure integrations later.

## 2. Grant Lead
Operational owner for grant work.

Can:
- Create/edit grants.
- Create/edit funders.
- Create/edit applications.
- Assign tasks.
- Manage application statuses.
- Run AI grant/funder/application workflows.
- Mark grants as Top 3 Priority.
- Link Google Docs/Drive folders.
- Add and edit proof items.

Cannot:
- Manage users/roles unless also admin.
- Change organization-level settings.

## 3. Contributor
Project or proof contributor.

Can:
- Create/edit assigned projects.
- Add proof items.
- Upload/link documents.
- Edit assigned application questions.
- Complete assigned tasks.
- View relevant grants/applications.

Cannot:
- Delete major records.
- Manage funders globally.
- Change grant priority unless allowed.
- Manage users.

## 4. Reviewer
Advisor/reviewer with limited editing.

Can:
- View assigned applications.
- View related project/proof context.
- Add review notes/comments if comments are implemented.
- Mark assigned question/review item as reviewed later.

Cannot:
- Edit final application content unless explicitly assigned.
- Create/delete grants.
- Manage funders.
- Change system settings.

## 5. Viewer
Read-only internal access.

Can:
- View dashboard records.
- View public/private project summaries depending on org policy.
- View grant/application status.

Cannot:
- Edit records.
- Run AI workflows.
- Manage tasks.
- View highly sensitive notes if field-level restrictions are added later.

## Public Visitor
Unauthenticated user.

Can:
- View public website.
- View projects and proof items marked `public_visibility = true`.
- Submit contact form.

Cannot:
- Access dashboard.
- View private notes, docs, applications, funder contacts, or internal strategy.

## Permissions Matrix

| Action | Admin | Grant Lead | Contributor | Reviewer | Viewer | Public |
|---|---:|---:|---:|---:|---:|---:|
| View public website | Yes | Yes | Yes | Yes | Yes | Yes |
| View dashboard | Yes | Yes | Yes | Limited | Yes | No |
| Manage users | Yes | No | No | No | No | No |
| Manage org settings | Yes | No | No | No | No | No |
| Create/edit projects | Yes | Yes | Assigned/limited | No | No | No |
| Create/edit proof items | Yes | Yes | Yes | No | No | No |
| Publish proof/project publicly | Yes | Yes | No | No | No | No |
| Create/edit grants | Yes | Yes | No | No | No | No |
| Mark Top 3 grants | Yes | Yes | No | No | No | No |
| Create/edit funders | Yes | Yes | No | No | No | No |
| Create/edit peer orgs | Yes | Yes | No | No | No | No |
| Create/edit applications | Yes | Yes | Assigned sections | Review only | No | No |
| Create/edit tasks | Yes | Yes | Assigned tasks | No | No | No |
| Run AI workflows | Yes | Yes | Limited | No | No | No |
| Submit final grant | Human outside system | Human outside system | No | No | No | No |

## Human-in-the-Loop Rules

AI can:
- Summarize.
- Draft.
- Score.
- Suggest.
- Rank.
- Extract.
- Prepare.

AI cannot in V1:
- Submit grant applications.
- Send external funder emails.
- Make irreversible status changes without user confirmation.
- Publish private proof publicly.
- Delete records.

## Public Visibility Rules

Only records with `public_visibility = true` can appear on the public website.

Public pages must never show:
- Internal notes.
- Portal URLs with credentials.
- Private Google Docs.
- Funder contact strategy.
- Draft application answers.
- Rejected grant analysis unless intentionally published.
