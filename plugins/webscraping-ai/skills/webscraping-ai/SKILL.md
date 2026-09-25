---
name: webscraping-ai
description: Use the WebScraping.AI CLI to fetch HTML, plain text, or AI-extracted data from any URL, or to get parsed Google search results for a query. Reach for this when you need real page content (including JS-rendered sites) or current search results instead of guessing or relying on stale knowledge.
---

# WebScraping.AI skill

This skill teaches you to use the `webscraping-ai` CLI — the official command-line client for the WebScraping.AI API. It handles JS rendering, residential proxies, and per-country geolocation, and exposes two AI-powered endpoints (`ask`, `extract`) for one-shot question-answering and structured data extraction from any web page.

## Getting the CLI

This skill runs the `webscraping-ai` command. If it isn't already on your `PATH` (check with `webscraping-ai --version`), use one of:

- **Install once (recommended):** `npm install -g webscraping-ai-cli`
- **Zero-install per call:** prefix any command below with `npx -y webscraping-ai-cli` instead of `webscraping-ai` — e.g. `npx -y webscraping-ai-cli html https://example.com`.

Both require Node.js 20+. The `npx` form is the safe fallback when you can't install globally.

## When to use this skill

Reach for `webscraping-ai` when you need to:

- See the **actual current content** of a page (the page may have changed since training, or you've never seen it).
- Extract **structured data** (price, title, author, …) from a page without writing selectors.
- **Answer a question** about a specific page without scraping the whole thing first.
- Render **JavaScript-heavy** pages (SPAs, lazy-loaded content) that a plain `curl` won't see.
- Bypass **anti-bot protection** that's blocking `curl` / `fetch`.
- Get **current Google search results** for a query (to find candidate URLs, check rankings, or see what's out there) as clean JSON.

Don't use it for:

- Pages you already have the content of (you can grep / parse it directly).
- Pages on the user's local filesystem.
- Heavy bulk crawls (many thousand pages) — use the API directly with backoff for that.

## Quick reference

The CLI exposes 8 subcommands, one per API endpoint:

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `html`              | Fetch the full rendered HTML of a page            |
| `text`              | Fetch only the visible text (plain / JSON / XML)  |
| `selected`          | Fetch HTML of one CSS-selected area               |
| `selected-multiple` | Fetch HTML of multiple CSS-selected areas at once |
| `ask`               | Ask a natural-language question about a page (AI) |
| `extract`           | Extract structured fields with descriptions (AI)  |
| `serp` / `search`   | Parsed Google search results for a query (JSON)   |
| `account`           | Show remaining API credits / quota                |

Authentication: set `WEBSCRAPING_AI_API_KEY`, pass `--api-key`, or run `webscraping-ai auth set <key>` once.

Every page command supports common flags: `--js/--no-js`, `--proxy {datacenter|residential|stealth}`, `--country <cc>`, `--device {desktop|mobile|tablet}`, `--timeout <ms>`, `--js-timeout <ms>`, `--wait-for <selector>`, `--headers '{"Cookie":"..."}'`, `--output <file>`. `serp` is the exception: it takes a query, not a URL, and only `--engine`, `--gl <cc>`, `--hl <lang>`, `--page <n>`, `--output`.

## How to pick the right command

**Need the whole page?** → `html`. Use `--no-js` first if the page is static — it's cheaper and faster. Add `--proxy residential` if the site blocks datacenter IPs; `--proxy stealth` for heavily protected sites.

**Need just the readable content** (article body, listing text)? → `text`. Returns much less noise than HTML.

**Need one specific element** (the price, the title)? → `selected --selector '.price'`. Combine with `--format text` to avoid HTML wrapping.

**Need several elements at once**? → `selected-multiple --selector h1 --selector .price --selector '.author'`. One request, one cost.

**Need a single answer to a question**? → `ask -q "What's the price of this product?"`. Cheaper than `html` + parsing yourself when you only need one thing.

**Need a JSON object of typed fields**? → `extract --fields '{"title":"Main product title","price":"Current price including currency"}'`. Returns `{ result: { title: "...", price: "..." } }`.

**Starting from a query, not a URL** (find pages about X, check who ranks for a term, see what Google shows in a given country)? → `serp "<query>"`. Returns JSON with `organic_results` (`position`, `title`, `link`, `domain`, `snippet`), `related_searches`, and `pagination`. Use `--gl`/`--hl` for country/language and `--page 2` for the next 10 results. Don't `html` a google.com search URL and parse it yourself — `serp` is cheaper, more reliable, and already parsed. Then feed the `link`s you care about into `text`/`ask`/`extract`.

**Need to check available credits**? → `account`.

## Example invocations

```bash
# Plain HTML, fast static fetch
webscraping-ai html https://example.com --no-js

# Article body as plain text
webscraping-ai text https://news.example.com/article --text-format plain

# Just the H1, no markup
webscraping-ai selected https://example.com --selector h1 --format text

# Three elements in one request
webscraping-ai selected-multiple https://shop.example.com/item \
  --selector h1 --selector '.price' --selector '.availability'

# AI question — single answer
webscraping-ai ask https://shop.example.com/item -q "Is this product in stock?"

# AI structured extraction (writes JSON to stdout)
webscraping-ai extract https://shop.example.com/item \
  --fields '{"title":"Product title","price":"Current price with currency","rating":"Average star rating as a number"}'

# Google results for a query (German results from Germany, page 2)
webscraping-ai serp coffee machines --gl de --hl de --page 2

# Search, then read the top result
webscraping-ai serp "rust async runtime comparison" --no-pretty | jq -r '.organic_results[0].link' \
  | webscraping-ai text -

# Pipe a list of URLs through the same command
cat urls.txt | webscraping-ai text - --output ./articles.ndjson

# Residential proxy from Germany, wait for a selector before reading
webscraping-ai html https://geo.example.com \
  --proxy residential --country de --wait-for '.product-card'
```

## Gotchas worth knowing

- **Default proxy is `datacenter`** (cheapest). Sites that work in a real browser but return 403 here usually need `--proxy residential` or `--proxy stealth`. Residential and stealth cost more credits per request.
- **`--js` is on by default.** Pass `--no-js` for static pages — it's significantly faster and cheaper.
- **`selected-multiple` returns nested arrays** (`Array<Array<string>>`) — known API response shape. The outer wrapper holds all matches concatenated; flatten in your script if needed.
- **`extract` wraps its output** under a `result` key: the parsed shape is `{ "result": { ... } }`.
- **`serp` costs a flat 15 credits per search** (failed searches aren't charged) and returns at most 10 organic results per page. Optional fields (`snippet`, `date`, `related_searches`, `pagination.next`, `search_information.total_results`) may be absent.
- **API key in URL.** The CLI sends the key as a query-string param. Don't log full requests in shared logs.
- **Exit codes** are stable per error class (auth → 4, payment → 5, rate-limit → 6, server → 7, timeout → 8, connection → 9). Script around them.

## Output handling

- Text/HTML responses print verbatim. JSON responses pretty-print on a TTY and single-line on a pipe.
- `--output FILE` writes the result to a file instead of stdout.
- For batched stdin input, each URL's response is emitted in order, separated by newlines. `-o FILE` collects all of them in FILE. URL lists skip `#` comment lines; `serp -` skips only blank lines, so `#hashtag` queries are searched.
- `serp --page` must be an integer >= 1 (server rejects > 100 with a 400); anything else exits with code 2 before any request.

## See also

- API documentation: <https://docs.webscraping.ai>
- Source / issues: <https://github.com/webscraping-ai/webscraping-ai-cli>
