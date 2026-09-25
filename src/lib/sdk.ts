/**
 * SDK adapter.
 *
 * Wraps the published `webscraping-ai` Node SDK. The CLI sends a
 * `from_cli=true` analytics flag on every endpoint except `account` (mirrors
 * `from_n8n` and `from_mcp_server` used by the n8n node and MCP server). On
 * `serp` and `data` it rides in the SDK's `params` pass-through, since those
 * methods drop unknown top-level keys. `account()` takes no options, so it
 * isn't tagged. The SDK's typed
 * options don't accept arbitrary keys, so we go through a single cast point
 * here rather than scattering casts across each command.
 */

import { WebScrapingAI } from 'webscraping-ai';

import { registerSecret } from './redact.js';
import type {
  DataOptions,
  FieldsOptions,
  HtmlOptions,
  QuestionOptions,
  SelectedMultipleOptions,
  SelectedOptions,
  SerpOptions,
  TextOptions,
} from 'webscraping-ai';

export interface CreateClientOptions {
  apiKey: string;
  /** Per-request timeout in ms. Maps to the SDK's `timeoutMs`. */
  requestTimeoutMs?: number;
}

/**
 * Returns a `WebScrapingAI` instance with the CLI's analytics tag baked into
 * every endpoint method. The methods preserve the SDK's public signatures.
 */
export function createClient(options: CreateClientOptions): WebScrapingAI {
  registerSecret(options.apiKey);
  const inner = new WebScrapingAI({
    apiKey: options.apiKey,
    timeoutMs: options.requestTimeoutMs,
  });

  // Wrap each endpoint method so it injects the CLI analytics tag. We splice
  // the tag in at this seam rather than at every callsite. The cast is local;
  // the SDK passes unknown query params through to the wire.
  const tag = { from_cli: true } as unknown as Record<string, never>;

  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      switch (prop) {
        case 'html':
          return (o: HtmlOptions) => target.html({ ...o, ...tag });
        case 'text':
          return (o: TextOptions) => target.text({ ...o, ...tag });
        case 'selected':
          return (o: SelectedOptions) => target.selected({ ...o, ...tag });
        case 'selectedMultiple':
          return (o: SelectedMultipleOptions) => target.selectedMultiple({ ...o, ...tag });
        case 'question':
          return (o: QuestionOptions) => target.question({ ...o, ...tag });
        case 'fields':
          return (o: FieldsOptions) => target.fields({ ...o, ...tag });
        case 'serp':
          // `serp()` drops unknown top-level keys but sends its `params`
          // pass-through as-is, so the tag goes there (CLI tag wins).
          return (o: SerpOptions) => target.serp({ ...o, params: { ...o.params, from_cli: true } });
        case 'data':
          // `data()` drops unknown top-level keys but sends its `params`
          // pass-through as-is, so the tag goes there (CLI tag wins).
          return (o: DataOptions) => target.data({ ...o, params: { ...o.params, from_cli: true } });
        case 'account':
          // `account` takes no options; the SDK builds the request itself, so
          // there's no seam here for the analytics tag — accepted limitation.
          return value.bind(target);
        default:
          return typeof value === 'function' ? value.bind(target) : value;
      }
    },
  });
}
