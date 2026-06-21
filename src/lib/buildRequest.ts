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
  FieldsOptions,
  HtmlOptions,
  QuestionOptions,
  SelectedMultipleOptions,
  SelectedOptions,
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
