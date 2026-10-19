/**
 * Per-step CDP timeout. The 2026-10-19 overnight script hung because a
 * Runtime.evaluate promise never settled. A timeout is data, not a stuck process.
 */

export class StepTimeoutError extends Error {
  constructor(step) {
    super('timeout');
    this.name = 'StepTimeoutError';
    this.ok = false;
    this.reason = 'timeout';
    this.step = step;
  }
}

export function isTimeout(error) {
  return error instanceof StepTimeoutError || error?.reason === 'timeout';
}

export function timeoutRecord(step, extra = {}) {
  return { ...extra, ok: false, reason: 'timeout', step };
}
