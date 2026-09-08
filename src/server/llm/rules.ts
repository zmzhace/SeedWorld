import 'server-only'

/**
 * Per-role rule buckets (ainovel-cli #91 `feat-rules` idea):
 * ontology / outline / draft / validate / revise each receive ONLY the
 * rules relevant to their job. No more mega-prompts where the drafter gets
 * validation criteria and the validator gets world-building instructions.
 *
 * Platform-governance rules (P0-2, adapted from 番茄治理细则 in
 * voocel/ainovel-cli#111) live ONLY in VALIDATE_RULES.
 * Anti-AI-tone baseline lives ONLY in DRAFT_RULES.
 */

export const ONTOLOGY_RULES = [
  'Analyze only this work; fit types to its actual material.',
  'Do not assume energy, abilities, romance, social media, or any genre convention unless present.',
  'Concrete people, groups, places, events, objects, species, natural or supernatural phenomena, abstract concepts and world rules are all valid entities.',
  'Facts must later support objective truth, public narrative and character belief.',
  'Visibility and conditional existence are generic rules, not hard-coded story types.',
].join('\n')

export const OUTLINE_RULES = [
  'Plan exactly one chapter, never the whole book.',
  'Default to a strictly limited viewpoint: only what the viewpoint character can perceive or reasonably know.',
  'Enter through concrete action, anomaly, or local conflict — never an encyclopedia opening or cast list.',
  'Reveal at most one unfamiliar rule, and only by demonstrating it in-scene.',
  'Budget reveals explicitly: which secret is shown, which is hinted, which stays hidden.',
  'End the chapter plan on a decision, consequence, or sharper question.',
].join('\n')

export const DRAFT_RULES = [
  'Write the full chapter text only. No explanations, no outline, no meta commentary.',
  'Never dump the setting as a manual; reveal the world through action and perception.',
  'Never leak secrets the viewpoint character cannot know (see visible facts only).',
  'One scene, one job: every paragraph either advances conflict or deepens character.',
  'Anti-AI-tone baseline (mechanical checks):',
  '- No 梗概-style writing: do not retell the plot outline; dramatize it.',
  '- No running-ledger narration: no mechanical lists of time, actions, or dialogue without narrative purpose.',
  '- No empty sublimation: no hollow uplift paragraphs unrelated to the plot.',
  '- No piled-up obscure concepts: explain through story, never lecture.',
  '- No templated open/close sentences repeated across chapters; vary rhythm and sentence shape.',
  '- No excessive environment description disconnected from the plot.',
  '- Punctuation and paragraphing must be clean; no garbled symbols.',
].join('\n')

export const VALIDATE_RULES = [
  'You are a continuity AND platform-compliance proofreader.',
  'Check knowledge trespass: does the text reveal anything the viewpoint character cannot know?',
  'Check time/place/causality conflicts and characters acting after death without explanation.',
  'Check setting/cost violations against the given facts.',
  'Platform-recommendation gate (adapted from 番茄低质内容治理细则) — flag as error:',
  '- 梗概式写文: retelling the outline instead of dramatizing scenes.',
  '- 流水账: mechanical ledger of time/actions/dialogue with no narrative shaping.',
  '- 节奏异常: abrupt transitions, rushed or dragging pacing, long stretches with no plot advance.',
  '- 人物单薄: thin characters, abrupt entrances, inconsistent protagonist behavior.',
  '- 空洞升华: hollow uplift or moralizing unrelated to the plot.',
  '- 无关堆砌: large environment descriptions or concept dumps disconnected from the story.',
  '- 模板化: formulaic opening/closing sentences or stitched-together feel.',
  '- 衔接断裂: adjacent content with no connective tissue, high proportion of irrelevant content.',
  'Every issue MUST quote the offending source text verbatim in the "quote" field — issues without evidence are rejected.',
  'Return JSON only: {"passed":boolean,"issues":[{"severity":"error|warning","dimension":"...","message":"...","quote":"..."}],"revisionInstructions":"..."}',
].join('\n')

export const REVISE_RULES = [
  'Revise ONLY the confirmed logic/compliance problems from the proofreading notes.',
  'Keep everything good untouched: voice, rhythm, dialogue, working scenes.',
  'Do not introduce new characters, settings, or secrets while revising.',
  'Output the complete revised Markdown chapter only.',
].join('\n')

export const COMPASS_RULES = [
  'Distinguish the far horizon (long) from the current working plan (current).',
  'long: ending direction + active long threads. Stable across chapters; update only at volume boundaries.',
  'current: the present arc goal + the next 1-3 chapter beats. Concrete and checkable.',
  'Never plan the whole book; the far future stays a compass, not a script.',
].join('\n')
