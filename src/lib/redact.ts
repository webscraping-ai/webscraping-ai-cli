/**
 * Secret redaction for anything the CLI prints to stderr.
 *
 * API errors can echo the request URL (e.g. an HTML error page that includes
 * `?api_key=...`), so every error message goes through `redactSecrets()`
 * before it is printed. The key in use is registered by `createClient()`.
 */

const secrets = new Set<string>();

/** Remember a secret so later error output never prints it. */
export function registerSecret(value: string | undefined): void {
  if (value && value.trim() !== '') secrets.add(value);
}

/** Forget registered secrets (tests only). */
export function clearSecrets(): void {
  secrets.clear();
}

const API_KEY_PARAM = /(api_key=)[^&\s"'<>]*/gi;

export function redactSecrets(text: string): string {
  let out = text.replace(API_KEY_PARAM, '$1[REDACTED]');
  const candidates = new Set(secrets);
  const env = process.env.WEBSCRAPING_AI_API_KEY?.trim();
  if (env) candidates.add(env);
  for (const secret of candidates) {
    for (const form of new Set([secret, encodeURIComponent(secret)])) {
      out = out.split(form).join('[REDACTED]');
    }
  }
  return out;
}
