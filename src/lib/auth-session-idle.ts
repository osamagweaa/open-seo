/**
 * Session lifetime for an idle timeout, from OPENSEO_SESSION_IDLE_MINUTES in
 * the given environment. Activity renews the session every minute, so only
 * idleness ends it. Unset or invalid keeps Better Auth's default lifetime.
 */
export function sessionIdleOptions(env: object) {
  const minutes: unknown = Reflect.get(env, "OPENSEO_SESSION_IDLE_MINUTES");
  const idleMinutes =
    typeof minutes === "string" ? Number(minutes) : Number.NaN;
  if (!Number.isFinite(idleMinutes) || idleMinutes <= 0) return {};
  const expiresIn = Math.round(idleMinutes * 60);
  return { expiresIn, updateAge: Math.min(60, Math.floor(expiresIn / 2)) };
}
