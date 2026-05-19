---
name: webscraping-ai
description: Use the WebScraping.AI CLI to fetch HTML, plain text, or AI-extracted data from any URL. Reach for this when you need real page content (including JS-rendered sites) instead of guessing or relying on stale knowledge.
---

# WebScraping.AI skill

This skill teaches you to use the `webscraping-ai` CLI — the official command-line client for the WebScraping.AI API. It handles JS rendering, residential proxies, and per-country geolocation, and exposes two AI-powered endpoints (`ask`, `extract`) for one-shot question-answering and structured data extraction from any web page.

## When to use this skill

Reach for `webscraping-ai` when you need to:

- See the **actual current content** of a page (the page may have changed since training, or you've never seen it).
- Extract **structured data** (price, title, author, …) from a page without writing selectors.
- **Answer a question** about a specific page without scraping the whole thing first.
- Render **JavaScript-heavy** pages (SPAs, lazy-loaded content) that a plain `curl` won't see.
- Bypass **anti-bot protection** that's blocking `curl` / `fetch`.

Don't use it for:

- Pages you already have the content of (you can grep / parse it directly).
- Pages on the user's local filesystem.
- Heavy bulk crawls (many thousand pages) — use the API directly with backoff for that.

## Quick reference

The CLI exposes 7 subcommands, one per API endpoint:

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `html`             | Fetch the full rendered HTML of a page                  |
| `text`             | Fetch only the visible text (plain / JSON / XML)        |
| `selected`         | Fetch HTML of one CSS-selected area                     |
| `selected-multiple`| Fetch HTML of multiple CSS-selected areas at once       |
| `ask`              | Ask a natural-language question about a page (AI)       |
| `extract`          | Extract structured fields with descriptions (AI)        |
| `account`          | Show remaining API credits / quota                      |

Authentication: set `WEBSCRAPING_AI_API_KEY`, pass `--api-key`, or run `webscraping-ai auth set <key>` once.

Every command supports common flags: `--js/--no-js`, `--proxy {datacenter|residential|stealth}`, `--country <cc>`, `--device {desktop|mobile|tablet}`, `--timeout <ms>`, `--js-timeout <ms>`, `--wait-for <selector>`, `--headers '{"Cookie":"..."}'`, `--output <file>`.

## How to pick the right command

**Need the whole page?** → `html`. Use `--no-js` first if the page is static — it's cheaper and faster. Add `--proxy residential` if the site blocks datacenter IPs; `--proxy stealth` for heavily protected sites.

**Need just the readable content** (article body, listing text)? → `text`. Returns much less noise than HTML.

**Need one specific element** (the price, the title)? → `selected --selector '.price'`. Combine with `--format text` to avoid HTML wrapping.

**Need several elements at once**? → `selected-multiple --selector h1 --selector .price --selector '.author'`. One request, one cost.

**Need a single answer to a question**? → `ask -q "What's the price of this product?"`. Cheaper than `html` + parsing yourself when you only need one thing.

**Need a JSON object of typed fields**? → `extract --fields '{"title":"Main product title","price":"Current price including currency"}'`. Returns `{ result: { title: "...", price: "..." } }`.

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
- **API key in URL.** The CLI sends the key as a query-string param. Don't log full requests in shared logs.
- **Exit codes** are stable per error class (auth → 4, payment → 5, rate-limit → 6, server → 7, timeout → 8, connection → 9). Script around them.

## Output handling

- Text/HTML responses print verbatim. JSON responses pretty-print on a TTY and single-line on a pipe.
- `--output FILE` writes the result to a file instead of stdout.
- For batched stdin input, each URL's response is emitted in order, separated by newlines.

## See also

- API documentation: <https://docs.webscraping.ai>
- Source / issues: <https://github.com/webscraping-ai/webscraping-ai-cli>
