# Changelog

All notable changes to `webscraping-ai-cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
