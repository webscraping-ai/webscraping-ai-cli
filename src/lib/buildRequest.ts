/**
 * Pure builder that maps `--flag` values into SDK option objects.
 *
 * Extracted as a separate function so unit tests can pin the mapping without
 * spinning up commander or making HTTP calls. Each command handler reads its
 * own commander options, awaits `parseHeaders` / `parseFields`, then calls
 * the matching `build*` function here.
 */

import type {
  CommonRequestOptions,
  DataOptions,
  FieldsOptions,
  HtmlOptions,
  QuestionOptions,
  SelectedMultipleOptions,
  SelectedOptions,
  SerpOptions,
  TextOptions,
} from 'webscraping-ai';

import type { CommonRawFlags } from './options.js';

export interface ResolvedCommonOptions {
  headers?: Record<string, string>;
}

export function buildCommonOptions(
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions = {},
): CommonRequestOptions {
  const out: CommonRequestOptions = {};
  // `flags.js` is `false` when `--no-js`, `true` when `--js`, `undefined`
  // when neither passed. Pass through only when explicit, so the API default
  // applies otherwise.
  if (flags.js !== undefined) out.js = flags.js;
  if (flags.proxy !== undefined) out.proxy = flags.proxy;
  if (flags.country !== undefined) out.country = flags.country;
  if (flags.device !== undefined) out.device = flags.device;
  if (flags.timeout !== undefined) out.timeout = flags.timeout;
  if (flags.jsTimeout !== undefined) out.js_timeout = flags.jsTimeout;
  if (flags.waitFor !== undefined) out.wait_for = flags.waitFor;
  if (flags.jsScript !== undefined) out.js_script = flags.jsScript;
  if (flags.customProxy !== undefined) out.custom_proxy = flags.customProxy;
  if (flags.errorOn404) out.error_on_404 = true;
  if (flags.errorOnRedirect) out.error_on_redirect = true;
  if (resolved.headers) out.headers = resolved.headers;
  return out;
}

export interface HtmlExtras {
  returnScriptResult?: boolean;
}

export function buildHtmlOptions(
  url: string,
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
  extras: HtmlExtras = {},
): HtmlOptions {
  const out: HtmlOptions = { url, ...buildCommonOptions(flags, resolved) };
  if (flags.format) out.format = flags.format;
  if (extras.returnScriptResult) out.return_script_result = true;
  return out;
}

export interface TextExtras {
  textFormat?: 'plain' | 'json' | 'xml';
  returnLinks?: boolean;
}

export function buildTextOptions(
  url: string,
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
  extras: TextExtras = {},
): TextOptions {
  const out: TextOptions = { url, ...buildCommonOptions(flags, resolved) };
  if (extras.textFormat) out.text_format = extras.textFormat;
  if (extras.returnLinks) out.return_links = true;
  return out;
}

export function buildSelectedOptions(
  url: string,
  selector: string | undefined,
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
): SelectedOptions {
  // `selector` is optional per the OpenAPI spec: omitting it returns the
  // whole-page HTML. Only attach it when provided. (The installed SDK types
  // still mark it required, so build the object as a partial and cast.)
  const out: Partial<SelectedOptions> = { url, ...buildCommonOptions(flags, resolved) };
  if (selector !== undefined) out.selector = selector;
  if (flags.format) out.format = flags.format;
  return out as SelectedOptions;
}

export function buildSelectedMultipleOptions(
  url: string,
  selectors: readonly string[],
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
): SelectedMultipleOptions {
  // `selectors` is optional per the OpenAPI spec: omitting it returns the
  // whole-page HTML. Only attach it when non-empty. (The installed SDK types
  // still mark it required, so build the object as a partial and cast.)
  const out: Partial<SelectedMultipleOptions> = { url, ...buildCommonOptions(flags, resolved) };
  if (selectors.length > 0) out.selectors = selectors;
  return out as SelectedMultipleOptions;
}

export function buildQuestionOptions(
  url: string,
  question: string,
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
): QuestionOptions {
  const out: QuestionOptions = { url, question, ...buildCommonOptions(flags, resolved) };
  if (flags.format) out.format = flags.format;
  return out;
}

export function buildFieldsOptions(
  url: string,
  fields: Record<string, string>,
  flags: CommonRawFlags,
  resolved: ResolvedCommonOptions,
): FieldsOptions {
  return { url, fields, ...buildCommonOptions(flags, resolved) };
}

export interface SerpRawFlags {
  engine?: 'google';
  gl?: string;
  hl?: string;
  page?: number;
}

/**
 * `/serp` is query-shaped: it takes none of the common scrape options, so
 * this deliberately does not go through `buildCommonOptions`. `page` must be
 * an integer >= 1 (the server also rejects anything else with a 400, not
 * billed; checking client-side saves the round trip). Pages are 1-100: the
 * server rejects a page above 100 with a 400.
 */
export function buildSerpOptions(query: string, flags: SerpRawFlags = {}): SerpOptions {
  // Validate on the trimmed value but send the query as the user typed it.
  if (typeof query !== 'string' || query.trim() === '') {
    throw new Error('serp requires a non-empty query');
  }
  const out: SerpOptions = { q: query };
  if (flags.engine !== undefined) out.engine = flags.engine;
  if (flags.gl) out.gl = flags.gl;
  if (flags.hl) out.hl = flags.hl;
  if (flags.page !== undefined) {
    if (!Number.isSafeInteger(flags.page) || flags.page < 1) {
      throw new Error(`--page must be an integer >= 1, got: ${flags.page}`);
    }
    out.page = flags.page;
  }
  return out;
}

export interface DataRawFlags {
  country?: string;
  transcript?: boolean;
  transcriptLanguage?: string;
  /** Raw repeatable `--param key=value` strings. */
  param?: readonly string[];
}

/** Keys `--param` must never set: owned by the SDK/CLI. */
const RESERVED_DATA_PARAMS = new Set(['api_key', 'url', 'from_cli', '__proto__']);

/** `--param` keys that have their own flag: reject and point at the flag. */
const NAMED_DATA_PARAMS: Record<string, string> = {
  country: '--country',
  transcript: '--transcript',
  transcript_language: '--transcript-language',
};

/**
 * Parse repeatable `--param key=value` flags into a plain object. Splits on
 * the first `=`, so values may contain `=`. Throws on a missing `=`, an empty
 * or repeated key, a reserved key (`api_key`, `url`, `from_cli`,
 * `__proto__`), or a key that has its own flag (`country` → use `--country`).
 */
export function parseDataParams(raw: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const entry of raw) {
    const eq = entry.indexOf('=');
    if (eq <= 0) throw new Error(`--param must be key=value, got: ${entry}`);
    const key = entry.slice(0, eq);
    if (RESERVED_DATA_PARAMS.has(key)) {
      throw new Error(`--param must not set "${key}"`);
    }
    if (Object.hasOwn(NAMED_DATA_PARAMS, key)) {
      throw new Error(`--param must not set "${key}"; use ${NAMED_DATA_PARAMS[key]}`);
    }
    if (Object.hasOwn(out, key)) {
      throw new Error(`--param "${key}" given more than once`);
    }
    out[key] = entry.slice(eq + 1);
  }
  return { ...out };
}

/**
 * `/data` is URL-shaped but takes none of the common scrape options, so this
 * deliberately does not go through `buildCommonOptions`. The URL is passed
 * through unmodified: there is no client-side site check (sites are added
 * server-side; the API answers an unsupported URL with a free 400).
 */
export function buildDataOptions(url: string, flags: DataRawFlags = {}): DataOptions {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('data requires a non-empty url');
  }
  const out: DataOptions = { url };
  if (flags.country) out.country = flags.country;
  if (flags.transcript !== undefined) out.transcript = flags.transcript;
  if (flags.transcriptLanguage) out.transcript_language = flags.transcriptLanguage;
  const params = parseDataParams(flags.param);
  if (Object.keys(params).length > 0) out.params = params;
  return out;
}
