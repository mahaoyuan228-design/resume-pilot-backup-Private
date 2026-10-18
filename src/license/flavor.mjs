// Build flavor flags. Internal daily builds never import this into worker.mjs.
// Paid packages set BUILD_FLAVOR via generated paid-config.mjs at packaging time.

export const FLAVOR_INTERNAL = 'internal';
export const FLAVOR_PAID = 'paid';

/** @param {unknown} value */
export function normalizeFlavor(value) {
  if (value === FLAVOR_PAID) return FLAVOR_PAID;
  return FLAVOR_INTERNAL;
}

/** True only for an explicit paid package; default / missing / typo → internal. */
export function isPaidFlavor(value) {
  return normalizeFlavor(value) === FLAVOR_PAID;
}
