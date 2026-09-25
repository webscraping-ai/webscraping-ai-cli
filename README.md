# webscraping-ai-cli

[![npm](https://img.shields.io/npm/v/webscraping-ai-cli.svg)](https://www.npmjs.com/package/webscraping-ai-cli)
[![CI](https://github.com/webscraping-ai/webscraping-ai-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/webscraping-ai/webscraping-ai-cli/actions/workflows/ci.yml)

Official command-line client for the [WebScraping.AI](https://webscraping.ai) API. Fetch HTML, plain text, AI-extracted data, or single CSS selections from any URL — with JavaScript rendering, residential / stealth proxies, and per-country geolocation. See the [API documentation](https://webscraping.ai/docs) for the full parameter reference.

Ships with an **AI agent skill** that you can install into Claude Code, Cursor, Windsurf, Kiro, OpenCode, Gemini CLI, GitHub Copilot, Augment, or Factory — your coding agent learns when and how to use the CLI for live page fetches.

## Install

```bash
npm install -g webscraping-ai-cli
# or run without installing
npx -y webscraping-ai-cli --help
```

The package exposes two executables: `webscraping-ai` (primary) and `wsai` (short alias).

## Authenticate

[Sign up](https://webscraping.ai/auth/sign_up) to get an API key — the free
trial includes 2,000 credits, no credit card required. Your key lives in the
[dashboard](https://webscraping.ai/dashboard).

Pick one:

```bash
# 1. Environment variable (simplest in CI)
export WEBSCRAPING_AI_API_KEY=your-key-here

# 2. Persist to ~/.config/webscraping-ai/config.json (chmod 0600)
webscraping-ai auth set your-key-here

# 3. Pass per command
webscraping-ai html https://example.com --api-key your-key-here
```

## Commands

```bash
webscraping-ai html  <url> [flags]         # Full rendered HTML
webscraping-ai text  <url> [flags]         # Visible text (plain | json | xml)
webscraping-ai selected <url> --selector <css>           # One CSS area
webscraping-ai selected-multiple <url> --selector a --selector b ...
webscraping-ai ask <url> --question "..."  # AI question about the page
webscraping-ai extract <url> --fields '{"title":"...","price":"..."}'
webscraping-ai serp <query> [--gl us] [--hl en] [--page 1]  # Parsed Google results (alias: search)
webscraping-ai account                     # Remaining credits / quota
```

`serp` (alias `search`) is query-shaped, not URL-shaped: it takes `--engine` (`google`, the default), `--gl` (country), `--hl` (language), `--page` (1-based, 10 results per page) plus `--api-key`/`--output`/`--pretty`, and none of the scrape flags below. It prints the JSON result (`search_parameters`, `search_information`, `organic_results`, `related_searches`, `pagination`). Flat 15 credits per search; failed searches are not charged. `--page` must be an integer >= 1 (the server caps it at 100); anything else is a usage error (exit 2) before any request. Multi-word queries don't need quoting; `-` reads one query per line from stdin, skipping only blank lines (a leading `#` is kept as part of the query, e.g. `#coffee`). The CLI's `from_cli` analytics flag is not sent on `serp` (the SDK forwards only the SERP parameters).

Common flags shared by every scrape command:

| Flag                     | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `--js` / `--no-js`       | Toggle JavaScript rendering (default: on)            |
| `--proxy TYPE`           | `datacenter` (default), `residential`, `stealth`     |
| `--country CC`           | Two-letter proxy country code                        |
| `--device TYPE`          | `desktop`, `mobile`, `tablet`                        |
| `--timeout MS`           | Total page-retrieval timeout (max 30000)             |
| `--js-timeout MS`        | JS rendering time after page load (max 20000)        |
| `--wait-for CSS`         | CSS selector to wait for                             |
| `--headers JSON`         | HTTP headers to forward; inline JSON or `@file.json` |
| `--custom-proxy URL`     | `http://user:pass@host:port`                         |
| `--js-script CODE`       | Custom JS to evaluate on the target page             |
| `--error-on-404`         | Treat 404 responses as errors                        |
| `--error-on-redirect`    | Treat redirects as errors                            |
| `--output FILE`          | Write to FILE instead of stdout                      |
| `--pretty / --no-pretty` | Force pretty / single-line JSON                      |

`<url>` may be `-` to read URLs from stdin (one per line; lines starting with `#` are ignored). With `--output FILE`, a stdin batch writes every result to FILE, one after another (the file is truncated once at the start).

## Install the AI agent skill

```bash
# Just for Claude Code
webscraping-ai setup skill --editor claude-code

# All supported editors
webscraping-ai setup skill --all

# List what's supported
webscraping-ai setup list
```

Supported editor ids: `claude-code`, `cursor`, `windsurf`, `kiro`, `opencode`, `gemini`, `copilot`, `augment`, `factory`. Re-run with `--force` to overwrite existing installations.

You can also install the skill via the Claude Code [Plugin Marketplace](https://docs.anthropic.com/en/docs/claude-code/plugins) using the bundled `plugins/webscraping-ai/.claude-plugin/marketplace.json`.

## Exit codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 0    | Success                                         |
| 2    | Usage error (commander)                         |
| 3    | 400 Bad Request from the API                    |
| 4    | 403 Authentication error                        |
| 5    | 402 Payment Required (out of credits)           |
| 6    | 429 Rate limit                                  |
| 7    | 500 Server error (or wrapped target-page error) |
| 8    | Timeout (504 or local AbortController)          |
| 9    | Connection / DNS failure                        |
| 1    | Anything else                                   |

Scripts can branch on these without parsing stderr.

## Examples

```bash
# Fast static fetch
webscraping-ai html https://example.com --no-js

# Residential proxy from Germany, wait for a selector
webscraping-ai html https://geo.example.com \
  --proxy residential --country de --wait-for '.product-card'

# Pipe URLs through extract
cat urls.txt | webscraping-ai extract - \
  --fields '{"title":"Product title","price":"Current price"}' \
  --output products.ndjson

# Google results for a query, page 2, from Germany in German
webscraping-ai serp coffee machines --gl de --hl de --page 2

# Just the organic result links
webscraping-ai search "best espresso grinder" | jq -r '.organic_results[].link'

# Headers from a file
webscraping-ai html https://example.com --headers @./headers.json
```

## Links

- [WebScraping.AI](https://webscraping.ai) — features, pricing, signup
- [API documentation](https://webscraping.ai/docs)
- [Dashboard](https://webscraping.ai/dashboard) — API key, usage, request builder
- Other official clients: [Python](https://github.com/webscraping-ai/webscraping-ai-python) · [JavaScript](https://github.com/webscraping-ai/webscraping-ai-js) · [Ruby](https://github.com/webscraping-ai/webscraping-ai-ruby) · [PHP](https://github.com/webscraping-ai/webscraping-ai-php) · [Go](https://github.com/webscraping-ai/webscraping-ai-go) · [Java](https://github.com/webscraping-ai/webscraping-ai-java) · [.NET](https://github.com/webscraping-ai/webscraping-ai-dotnet) · [MCP server](https://github.com/webscraping-ai/webscraping-ai-mcp-server) · [n8n node](https://github.com/webscraping-ai/webscraping-ai-n8n)
- Support: [support@webscraping.ai](mailto:support@webscraping.ai)

## License

[MIT](./LICENSE) — © WebScraping.AI
