# Changelog

All notable changes to `webscraping-ai-cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.2.1 — 2026-09-26

### Security

- Dev dependencies updated for open Dependabot alerts (`vitest` 3 → 4, `vite`, `postcss`, `js-yaml`, `brace-expansion`). No command or behavior changes.

## 1.2.0 — 2026-09-25

### Added

- `data <url>` subcommand wrapping the new `/data` endpoint: structured JSON for a page on a supported site (e.g. YouTube, TikTok, X, LinkedIn, Instagram, Reddit; more are added server-side). Flags: `--country` (proxy country, `us` by default), `--transcript` (YouTube videos only; if the transcript fetch itself fails, the whole request fails with a 500, exit 7, not charged), `--transcript-language`, and a repeatable `--param key=value` passed through as-is for site-specific parameters. `-` reads one URL per line from stdin (stops at the first failing item, like every command); `-o` and `--pretty`/`--no-pretty` work as on `serp`. The scrape flags (`--js`, `--proxy`, `--headers`, …) don't apply and aren't registered on it. 15 credits per request.
- The URL is sent exactly as given and never checked against a list of sites. An unsupported URL or page type returns a 400 that is not charged (exit 3); its message lists what is supported. A blank URL exits 2 before any request.
- `--param` rejects, with exit 2 before any request: a missing `=` or empty key, a repeated key, `api_key`, `url`, `from_cli`, `__proto__`, and keys that have their own flag (`country`, `transcript`, `transcript_language` — the message names the flag).
- Bundled agent skill documents when to reach for `data` before scraping a supported site yourself.
- Smoke script adds a YouTube `data` call (checks `parse_status` `ok`, provider `youtube`, a non-empty `data.title`) and an example.com call that must exit 3 with a server 400 whose message contains `Unsupported URL` (~46 credits per sweep).

### Changed

- Requires the `webscraping-ai` SDK release after 4.1.0 (adds `data()` and the `params` pass-through on `serp()`/`data()`).
- `from_cli` is now sent on `serp` and `data`, through the SDK's `params` pass-through (closes the known gap: SDK 4.1.0's `serp()` dropped it).

### Fixed

- `-o/--output` in stdin batch mode is truncated when the batch starts, so an empty stdin or a failing first item no longer leaves the previous run's content in the file.

## 1.1.0 — 2026-09-25

### Added

- `serp <query>` subcommand (alias `search`) wrapping the new `/serp` endpoint: parsed Google search results as JSON. Flags: `--engine` (`google`), `--gl`, `--hl`, `--page <n>`. Multi-word queries don't need quoting; `-` reads one query per line from stdin. The scrape flags (`--js`, `--proxy`, `--country`, …) don't apply and aren't registered on it. Flat 15 credits per search.
- Bundled agent skill documents when to reach for `serp` (query-first research) instead of scraping a search URL.

### Changed

- Requires `webscraping-ai` SDK `^4.1.0` (adds `serp()`).
- `serp --page` is validated strictly (digits only, >= 1): `1.5`, `2abc` and `0` are rejected with exit code 2 before stdin is read or the key is resolved (the server also rejects them with a 400, not billed; checking client-side saves the round trip). Pages are 1–100: the server rejects a `page` above 100 with a 400.
- `serp` stdin batches skip only blank lines, so `#hashtag` queries are searched rather than dropped as comments. URL commands still treat `#` lines as comments.
- `serp` sends the query as typed (whitespace-only queries are still rejected). `from_cli` is not sent on `serp`: the SDK forwards only the SERP parameters.

### Fixed

- `--pretty` / `--no-pretty` no longer fail with "option '--no-pretty' cannot be used with option '--no-pretty'" (a self-conflict on every scrape command and `serp`).
- `-o/--output` in stdin batch mode kept only the last result; the file is now truncated once and each result appended.
- Error messages printed to stderr redact the API key and any `api_key=...` pattern (an HTML error body echoing the request URL used to print the key).
- Smoke script (`npm run smoke`) now checks results, not just exit codes: `serp` needs non-empty `organic_results` and a matching `search_parameters.q`, `selected-multiple` needs a non-empty inner array; signal-killed runs fail; page commands run with `--no-js --proxy datacenter` (~31 credits per sweep); FAIL lines redact the key.

## 1.0.2 — 2026-07-17

### Changed

- Documentation: expanded README — API docs, signup/dashboard links, badges, and links to the other official clients; package metadata homepage now points to https://webscraping.ai where it previously pointed at GitHub.

## [1.0.1] — 2026-06-21

### Fixed

- `auth set` now enforces `0600` permissions on an existing credential file, not only when creating it.
- `selected` and `selected-multiple` no longer require a selector; omitting it returns whole-page HTML, matching the API.

## [1.0.0] — 2026-05-19

Initial release.

### Added

- Seven endpoint subcommands wrapping the WebScraping.AI API:
  `html`, `text`, `selected`, `selected-multiple`, `ask`, `extract`, `account`.
- `auth set` / `auth show` / `auth clear` for managing the API key in
  `~/.config/webscraping-ai/config.json` (alternative to the
  `WEBSCRAPING_AI_API_KEY` environment variable).
- `setup skill` installs a bundled AI agent skill into Claude Code, Cursor,
  Windsurf, Kiro, OpenCode, Gemini CLI, GitHub Copilot, Augment, and Factory.
- Two executable names: `webscraping-ai` (primary) and `wsai` (short alias).
- Stdin batch mode: piping URLs to a command runs it per line.
- Common scraping flags (`--js/--no-js`, `--proxy`, `--country`, `--device`,
  `--timeout`, `--js-timeout`, `--wait-for`, `--headers`, `--js-script`,
  `--custom-proxy`, `--error-on-404`, `--error-on-redirect`).
- Output controls: `--output FILE`, `--format text|json`, `--pretty`.
