/**
 * Read-only readiness codes recorded by the overnight page probes.
 * No site is claimed supported. Never Save.
 */

export const READINESS_NEEDS_LOGIN = 'needs_login';
export const READINESS_FORM_VISIBLE = 'form_visible_readonly_ok';
export const READINESS_EMPTY = 'empty_or_spa_loading';

export function classifyReadinessProbe(probe) {
  if (!probe || typeof probe !== 'object') return READINESS_EMPTY;
  if (probe.loginHints === true) return READINESS_NEEDS_LOGIN;
  const count = Number(probe.inputCount);
  if (Number.isFinite(count) && count > 0) return READINESS_FORM_VISIBLE;
  return READINESS_EMPTY;
}

export function classifyReadinessPacket(packet) {
  return classifyReadinessProbe(packet?.probe || null);
}
