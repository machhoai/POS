export const REMOTE_SETTINGS_SUCCESS_RECONNECT_DELAY_MS = 1_000;

const RETRY_BASE_DELAY_MS = 3_000;
const RETRY_MAX_DELAY_MS = 60_000;
const RETRY_JITTER_RATIO = 0.2;

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - nowMs);
}

export function getRemoteSettingsRetryDelayMs(
  failureCount: number,
  retryAfterMs: number | null,
  randomValue = Math.random(),
): number {
  const normalizedFailureCount = Math.max(1, Math.floor(failureCount));
  const exponentialDelay = Math.min(
    RETRY_MAX_DELAY_MS,
    RETRY_BASE_DELAY_MS * 2 ** (normalizedFailureCount - 1),
  );
  const boundedRandomValue = Math.min(1, Math.max(0, randomValue));
  const jitterMultiplier =
    1 - RETRY_JITTER_RATIO + boundedRandomValue * RETRY_JITTER_RATIO * 2;
  const jitteredDelay = Math.round(exponentialDelay * jitterMultiplier);
  return Math.max(
    Math.min(RETRY_MAX_DELAY_MS, jitteredDelay),
    retryAfterMs ?? 0,
  );
}
