/**
 * Birth-date hint verdict literals.
 * No DOM lookup, no fill, no calendar click. Not a support claim.
 * The recorded status stays datepicker_hint_only.
 * DOB_* names are draft verdict literals. They are not fill reasons in cmb-basic.js.
 * Never Save. 招行 is not supported.
 */

export const DATEPICKER_HINT_ONLY = 'datepicker_hint_only';
export const DOB_HINT_MISSING = 'DOB_HINT_MISSING';
export const DOB_HINT_AMBIGUOUS = 'DOB_HINT_AMBIGUOUS';
export const DOB_CONTROL_UNOBSERVED = 'DOB_CONTROL_UNOBSERVED';
export const DOB_FORMAT_UNVERIFIED = 'DOB_FORMAT_UNVERIFIED';

export const CMB_BIRTHDATE_HINT_VERDICT_CODES = Object.freeze([
  DATEPICKER_HINT_ONLY,
  DOB_HINT_MISSING,
  DOB_HINT_AMBIGUOUS,
  DOB_CONTROL_UNOBSERVED,
  DOB_FORMAT_UNVERIFIED
]);

/** Recorded claim for this resume page. Not a live calendar result. */
export const CMB_BIRTHDATE_RECORDED_VERDICT = DATEPICKER_HINT_ONLY;

export function isCmbBirthDateHintVerdictCode(value) {
  return CMB_BIRTHDATE_HINT_VERDICT_CODES.includes(value);
}
