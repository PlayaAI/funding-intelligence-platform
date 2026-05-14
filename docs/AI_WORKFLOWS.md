# AI Workflows Blueprint

## AI Role
AI is an internal assistant for grant operations. It is not the main identity of the public website.

AI should help the team:
- Research.
- Summarize.
- Score.
- Draft.
- Suggest proof.
- Identify risks.
- Prepare applications.

AI must not:
- Submit applications.
- Send external emails.
- Publish public content without approval.
- Delete records.
- Make irreversible decisions.

## AI Output Principles

- Use structured JSON when saving results.
- Show human-readable summaries in the UI.
- Store input snapshot and output for traceability.
- Always include confidence and caveats when useful.
- Treat AI output as a draft, not final truth.

## V1 AI Workflows

## 1. Grant Summary

### Trigger
User opens grant detail and clicks “Summarize Grant.”

### Inputs
- Grant title.
- Funder.
- Deadline.
- Amount.
- Eligibility.
- Focus areas.
- Source text/PDF text if available.

### Output JSON
```json
{
  "summary": "Short grant summary",
  "who_should_apply": "Ideal applicant profile",
  "key_requirements": ["Requirement 1"],
  "important_dates": ["Deadline"],
  "required_documents": ["Document"],
  "risks_or_unknowns": ["Risk"],
  "recommended_next_steps": ["Step"]
}
```

### UI
Show a card on grant detail under AI Notes.

## 2. Grant Fit Analysis

### Trigger
User selects project and clicks “Analyze Fit.”

### Inputs
- Grant data.
- Project profile.
- Proof items.
- Team notes.

### Output JSON
```json
{
  "fit_score": 0,
  "priority_score": 0,
  "urgency_score": 0,
  "difficulty_score": 0,
  "recommendation": "apply | watch | ignore | needs_more_research",
  "why_it_fits": ["Reason"],
  "why_it_may_not_fit": ["Concern"],
  "best_project_angle": "Recommended framing",
  "missing_proof": ["Missing proof"],
  "next_steps": ["Action"]
}
```

### Scoring Guide
- Fit score: mission/focus/eligibility alignment.
- Priority score: strategic value + fit + funder relevance.
- Urgency score: deadline proximity.
- Difficulty score: application burden and missing requirements.

## 3. Draft Application Answer

### Trigger
User opens application question and clicks “Draft Answer.”

### Inputs
- Question.
- Word limit.
- Grant summary.
- Funder context.
- Project profile.
- Relevant proof items.
- Existing reusable grant language.

### Output JSON
```json
{
  "draft_answer": "Draft response",
  "short_version": "Optional condensed answer",
  "proof_used": ["Proof item title"],
  "claims_to_verify": ["Claim"],
  "suggested_improvements": ["Suggestion"]
}
```

### Rules
- Do not invent fake metrics.
- Do not imply formal partnerships that are not confirmed.
- Use grounded, credible language.
- Flag missing data instead of making it up.

## 4. Suggest Proof Items

### Trigger
User opens grant/application and clicks “Suggest Proof.”

### Inputs
- Grant/application requirements.
- Project profile.
- All linked proof items.

### Output JSON
```json
{
  "recommended_proof_items": [
    {
      "proof_item_id": "uuid",
      "title": "Proof title",
      "relevance_score": 0,
      "where_to_use": "Evidence of traction section",
      "reason": "Why this supports the application"
    }
  ],
  "missing_evidence": ["Missing evidence"],
  "proof_package_summary": "Narrative summary"
}
```

## V2 AI Workflows

## 5. Extract Application Questions

### Inputs
- Grant webpage text.
- Uploaded PDF text.
- Manual pasted application text.

### Output
- Questions.
- Word limits.
- Required attachments.
- Deadlines.
- Eligibility notes.

## 6. Funder Summary

### Inputs
- Funder profile.
- Giving history.
- Peer funding records.
- Notes.

### Output
```json
{
  "funder_summary": "Summary",
  "likely_priorities": ["Priority"],
  "typical_grant_size": "Range or note",
  "relevant_past_grantees": ["Org"],
  "best_project_match": "Project name",
  "outreach_angle": "Suggested angle",
  "risks_or_unknowns": ["Risk"]
}
```

## 7. Peer Funding Analysis

### Inputs
- Peer org profile.
- Funding records.
- Funder profiles.

### Output
```json
{
  "summary": "Funding pattern summary",
  "top_funders_to_research": [
    {
      "funder_name": "Name",
      "reason": "Why relevant",
      "priority": "high | medium | low"
    }
  ],
  "patterns": ["Pattern"],
  "next_steps": ["Step"]
}
```

## 8. Weekly Readiness Report

### Inputs
- Top grants.
- Upcoming deadlines.
- Open tasks.
- Applications.
- Missing proof/documents.

### Output
```json
{
  "week_summary": "Summary",
  "top_3_focus_grants": ["Grant"],
  "deadlines_to_watch": ["Deadline"],
  "blocked_applications": ["Application"],
  "recommended_actions": ["Action"],
  "risks": ["Risk"]
}
```

## Prompt Template Principles

Every AI prompt should include:

1. Role: expert grant strategist / funder researcher / application editor.
2. Context: this platform supports a proof-driven grant workflow.
3. Inputs: clearly delimited data.
4. Constraints: do not invent facts, flag unknowns, humans approve final output.
5. Output format: strict JSON.
6. Tone: credible, grounded, funder-ready, not hypey.

## Example System Prompt for AI Grant Fit

```txt
You are an expert grant strategist and nonprofit application reviewer. Analyze the grant and project profile below. Your job is to determine whether this project should apply, what the strongest angle is, what proof supports the application, and what risks or missing evidence exist.

Rules:
- Do not invent facts or metrics.
- If information is missing, list it as missing.
- Be direct and practical.
- Keep the tone funder-ready and credible.
- Return valid JSON only using the schema provided.
```

## AI Safety / Governance

- All AI-generated external-facing text must be reviewed by a human.
- All AI scores are advisory.
- Maintain audit history of AI outputs.
- Allow users to regenerate but preserve previous outputs.
- Show “Generated by AI, please verify” labels.
