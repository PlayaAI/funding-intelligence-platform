-- Seed Script: Editable Agent Knowledge Base
-- Provides initial approved guardrails and rules.

insert into public.agent_knowledge_items (title, category, content, knowledge_type, priority, confidence_status, status)
values
(
  'Org-Safe Language',
  'Safety',
  'Always use "Accord" or "Guidelines" instead of "Manifesto" with Org-adjacent stakeholders. Use "human-centered AI" and "public-benefit technology".',
  'safer_language',
  'high',
  'approved',
  'active'
),
(
  'Decommodification Guardrail',
  'Safety',
  'Do not promise commercial monetization of user data or direct exploitation of Burning Man culture for profit.',
  'do_not_use',
  'high',
  'approved',
  'active'
),
(
  'Evidence First',
  'Drafting',
  'Always prioritize using facts backed by actual Proof Items before generating new claims. If proof is missing, flag it for the human.',
  'custom_instruction',
  'high',
  'approved',
  'active'
),
(
  'Fiscal Sponsorship Language',
  'Eligibility',
  'Playa AI uses fiscal sponsorship. Do not claim direct 501(c)(3) status unless explicitly approved for the specific entity applying.',
  'custom_instruction',
  'high',
  'approved',
  'active'
),
(
  'Speculative Claims Filter',
  'Safety',
  'Always separate built/tested features (e.g., Connect App MVP with ~80 users) from planned or conceptual features. Do not claim the physical Oracle cube is built yet. Do not claim global consciousness or "machine with soul" in funder materials.',
  'risky_claim',
  'high',
  'approved',
  'active'
);
