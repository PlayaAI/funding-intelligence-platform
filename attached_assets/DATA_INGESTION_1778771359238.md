# Data Ingestion Blueprint

## Goal
Bring grant, funder, peer organization, document, and proof data into the system without overbuilding complex scraping too early.

## Principle
Start manual and structured. Add automation only after the core dashboard workflow is useful.

## V1 Data Entry

### Manual Entry
Users can manually create:
- Projects.
- Grants.
- Funders.
- Peer organizations.
- Peer funding records.
- Applications.
- Tasks.
- Proof items.
- Documents/links.

Manual entry is acceptable for MVP.

## CSV Import

### Grant CSV Fields
- title
- funder_name
- deadline
- amount_min
- amount_max
- focus_areas
- geography
- eligibility
- application_url
- source_url
- notes

### Funder CSV Fields
- name
- ein
- website
- location
- assets
- annual_giving
- median_grant_amount
- openness_to_new_grantees
- notes

### Peer Funding CSV Fields
- peer_organization_name
- peer_organization_ein
- funder_name
- funder_ein
- year
- amount
- source_url
- notes

### Import Requirements
- Preview before saving.
- Validate required fields.
- Show duplicates.
- Allow user to confirm/skip duplicates.
- Save source filename/date.

## PDF Upload

### V1
Upload PDF/document and attach to:
- Grant.
- Application.
- Project.
- Proof item.

### V1 Optional
Extract text from PDF for AI summarization if straightforward.

### Later
OCR and table extraction for 990-style PDFs.

## URL Import

### V1 Optional
User pastes URL. System stores URL and optionally extracts page text.

### Extracted Fields to Attempt
- Grant title.
- Funder.
- Deadline.
- Amount.
- Eligibility.
- Requirements.
- Application URL.
- Contact info.

### Human Review Required
All extracted fields must be reviewed before saving.

## 990 / Funder Data

### MVP Approach
Do not build full automatic 990 parsing first.

Start by allowing manual peer funding records:
- Peer organization.
- Funder.
- Year.
- Amount.
- Source URL.

### Later Approach
Add ingestion from public nonprofit/foundation datasets.

Possible sources later:
- IRS 990 data.
- ProPublica nonprofit data.
- Foundation websites.
- Public annual reports.
- Manually uploaded 990 PDFs.

## Peer Organization Workflow

1. User adds peer organization.
2. User manually adds funding records or imports CSV.
3. System links funders.
4. AI analyzes patterns.
5. User saves promising funders to research list.

## Data Normalization Rules

### Funder Names
- Normalize names to reduce duplicates.
- Store raw source name when importing.
- Allow merge duplicates later.

### Dates
- Store deadlines as dates.
- Use timezone-independent date handling.

### Amounts
- Store numeric amounts where possible.
- Preserve raw text if amount is ambiguous.

### Tags/Focus Areas
- Use arrays for focus areas.
- Allow freeform tags in V1.
- Standardize later.

## Source Tracking
Every imported/extracted record should ideally store:
- Source URL.
- Source file.
- Import date.
- Imported by.
- Confidence if extracted by AI.

## Human Review Status
For imported/extracted data, add optional statuses later:
- raw
- reviewed
- verified
- rejected

## Future Automation
Later agents can:
- Scan public grant sources weekly.
- Identify new opportunities.
- Extract summaries.
- Flag likely matches.
- Create draft records needing human review.

## What Not To Automate in V1
- Do not auto-submit grants.
- Do not auto-contact funders.
- Do not scrape aggressively without respecting source rules.
- Do not trust extracted data without human review.
