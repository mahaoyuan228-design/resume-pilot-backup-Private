/**
 * RankingMajor probe verdict literals.
 * No DOM lookup, no fill, no click. Not a support claim.
 * The recorded page verdict stays DOM_CONTROL_MISSING.
 * Never Save. 招行 is not supported.
 */

export const DOM_CONTROL_PRESENT = 'DOM_CONTROL_PRESENT';
export const DOM_CONTROL_MISSING = 'DOM_CONTROL_MISSING';
export const DOM_CONTROL_AMBIGUOUS = 'DOM_CONTROL_AMBIGUOUS';
export const PROBE_INCONCLUSIVE = 'PROBE_INCONCLUSIVE';

export const CMB_RANKINGMAJOR_VERDICT_CODES = Object.freeze([
  DOM_CONTROL_PRESENT,
  DOM_CONTROL_MISSING,
  DOM_CONTROL_AMBIGUOUS,
  PROBE_INCONCLUSIVE
]);

/** Recorded claim for this resume page. Not a live probe result. */
export const CMB_RANKINGMAJOR_RECORDED_VERDICT = DOM_CONTROL_MISSING;

export function isCmbRankingMajorVerdictCode(value) {
  return CMB_RANKINGMAJOR_VERDICT_CODES.includes(value);
}
