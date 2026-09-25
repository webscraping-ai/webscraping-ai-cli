# Changelog

All notable changes to `webscraping-ai-cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
