/** Cookie-authenticated writes and socket handshakes must come from our site. */
export function isSameSiteOrigin(origin: string | null | undefined, host: string | null | undefined): boolean {
  // Non-browser clients may omit Origin; they still need a signed cookie.
  if (!origin) return true
  if (!host) return false
  try { return new URL(origin).host === host } catch { return false }
}
