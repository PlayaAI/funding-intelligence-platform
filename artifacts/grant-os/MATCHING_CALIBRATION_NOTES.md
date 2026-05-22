# Grant OS Matching Calibration Notes

These examples are calibration references for the deterministic matching engine. They should guide weights, warnings, and decision-label behavior, but they are not hardcoded ranking outcomes.

## High-Priority Reference Examples

- MIT Solve: FII Innovators Pitch
- MIT Solve: 10th Anniversary Global Challenge
- AWS Imagine Grant
- .ORG Impact Awards
- Michelson Spark / Digital Equity
- Internet Society Foundation Research Grant
- CSET Foundational Research
- Global Pluralism Award
- Future of Work Accelerator
- Trust in Practice Awards

## Lower Or Special-Case Reference Examples

- AHRQ AI Healthcare Safety
- NIH neuroscience grants
- Generic arts/exhibition grants
- Government speaker/leadership programs
- Curatorial/arts grants

## Calibration Intent

The engine should favor strong AI, responsible technology, human connection, belonging, social trust, community infrastructure, and public-benefit technology signals.

Generic community, arts, cultural, or creative keywords should not outrank stronger AI/human-connection/responsible-tech alignment unless the project record clearly supports an arts, public installation, or community arts framing.

Healthcare, neuroscience, government-only, invite-only, and academic-only opportunities should be treated as special-case fits unless the project data contains matching eligibility and domain signals.

Eligibility, deadline feasibility, readiness evidence, and data completeness should visibly affect risks, missing items, recommended actions, and the strategic decision label.

## V1.0.3 Real-Data Calibration Issue

After importing the real Instrumentl ZIP datasets and regenerating matches, NIH/BRAIN/neuroscience grants were observed ranking as Top Matches around the low-to-mid 70s. The main causes were:

- source/import words such as `playa`, `imported`, `instrumentl`, and `dataset` were contributing to generic topic overlap;
- broad AI/research language could overpower the special-case healthcare/neuroscience mismatch;
- the imported project profiles were intentionally thin shells, causing readiness to be underestimated for strategic-fit grants while still allowing generic overlap to score too high.

V1.0.3 expectations:

- Source/noise words must not contribute meaningfully to topic-fit reasons or score.
- NIH, National Institutes of Health, BRAIN Initiative, clinical, biomedical, medical research, patient, hospital, treatment, disease, R01, R21, and R18 opportunities should be treated as healthcare/neuroscience special cases unless a project is explicitly framed for that domain.
- Healthcare/neuroscience special cases should carry a strong risk, lose meaningful points, avoid `best`/`strong` tiers, and usually receive `skip` or `needs_review`.
- The recommended action for those matches should be to skip unless Playa AI is deliberately reframed as a healthcare/neuroscience research project.
- Generic arts/culture/creative grants should not outrank AI, human-connection, social-trust, responsible-tech, public-benefit technology, or community-infrastructure opportunities unless the project clearly supports participatory arts/community-installation framing.

After applying this calibration and rerunning matching, manually check whether the following strategic references are easier to surface when present in the imported data:

- MIT Solve: FII Innovators Pitch
- MIT Solve: 10th Anniversary Global Challenge
- AWS Imagine Grant
- .ORG Impact Awards
- Michelson Spark / Digital Equity
- Internet Society Foundation Research Grant
- CSET Foundational Research
- Global Pluralism Award
- Future of Work Accelerator
- Trust in Practice Awards
