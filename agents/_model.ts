/**
 * Model & Gateway configuration
 */

const DEFAULT_MODEL = '@makers/hy3-preview';

export function resolveModelName(env?: Record<string, string | undefined>): string {
  // SERVICE_* is canonical; AI_GATEWAY_* kept as backward-compat alias
  return env?.SERVICE_MODEL || env?.AI_GATEWAY_MODEL || DEFAULT_MODEL;
}
