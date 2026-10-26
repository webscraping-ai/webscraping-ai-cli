---
name: webscraping-ai
description: Use the WebScraping.AI CLI to fetch HTML, plain text, or AI-extracted data from any URL, to get parsed Google search results for a query, or to get structured JSON data (/data) for any public web page. Reach for this when you need real page content (including JS-rendered sites) or current search results instead of guessing or relying on stale knowledge.
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
- Get **current Google search results** for a query (to find candidate URLs, check rankings, or see what's out there) as clean JSON.
- Get **structured data for a page** (a product, article, listing, profile, …) without writing selectors or a field list yourself.

Don't use it for:

- Pages you already have the content of (you can grep / parse it directly).
- Pages on the user's local filesystem.
- Heavy bulk crawls (many thousand pages) — use the API directly with backoff for that.

## Quick reference

The CLI exposes 10 subcommands, one per API endpoint:

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `html`              | Fetch the full rendered HTML of a page            |
| `text`              | Fetch only the visible text (plain / JSON / XML)  |
| `selected`          | Fetch HTML of one CSS-selected area               |
| `selected-multiple` | Fetch HTML of multiple CSS-selected areas at once |
| `ask`               | Ask a natural-language question about a page (AI) |
| `extract`           | Extract structured fields with descriptions (AI)  |
| `serp` / `search`   | Parsed Google search results for a query (JSON)   |
| `serp-locations`    | Look up location names for `serp --location`      |
| `data`              | Structured JSON for any public web page           |
| `account`           | Show remaining API credits / quota                |

Authentication: set `WEBSCRAPING_AI_API_KEY`, pass `--api-key`, or run `webscraping-ai auth set <key>` once.

Every page command supports common flags: `--js/--no-js`, `--proxy {datacenter|residential|stealth}`, `--country <cc>`, `--device {desktop|mobile|tablet}`, `--timeout <ms>`, `--js-timeout <ms>`, `--wait-for <selector>`, `--headers '{"Cookie":"..."}'`, `--output <file>`. `serp` is the exception: it takes a query, not a URL, and only `--engine`, `--gl <cc>`, `--hl <lang>`, `--page <n>`, `--pages <n>`, `--location <name>`, `--uule <value>`, `--lat <deg>`, `--lon <deg>`, `--radius <m>`, `--output`. `serp-locations [query]` takes only `--limit <n>` and `--output`. `data` takes a URL but its own flag set: `--country <cc>` (same meaning as on the page commands: the proxy country, `us` by default), `--transcript`, `--transcript-language <lang>`, `--param key=value`, `--output`. The other scrape flags (`--js`, `--proxy`, `--device`, `--timeout`, `--headers`, …) don't exist on `data`.

## How to pick the right command

**Need the whole page?** → `html`. Use `--no-js` first if the page is static — it's cheaper and faster. Add `--proxy residential` if the site blocks datacenter IPs; `--proxy stealth` for heavily protected sites.

**Need just the readable content** (article body, listing text)? → `text`. Returns much less noise than HTML.

**Need one specific element** (the price, the title)? → `selected --selector '.price'`. Combine with `--format text` to avoid HTML wrapping.

**Need several elements at once**? → `selected-multiple --selector h1 --selector .price --selector '.author'`. One request, one cost.

**Need a single answer to a question**? → `ask -q "What's the price of this product?"`. Cheaper than `html` + parsing yourself when you only need one thing.

**Need a JSON object of typed fields**? → `extract --fields '{"title":"Main product title","price":"Current price including currency"}'`. Returns `{ result: { title: "...", price: "..." } }`.

**Starting from a query, not a URL** (find pages about X, check who ranks for a term, see what Google shows in a given country)? → `serp "<query>"`. Returns JSON with `organic_results` (`position`, `title`, `link`, `domain`, `snippet`), `related_searches`, and `pagination`. Use `--gl`/`--hl` for country/language and `--page 2` for the next 10 results, or `--pages 3` to get pages 1–3 in one call as one de-duplicated list (up to 5; billed per results page returned). For local results ("best pizza" as seen from a city), add `--location 'Austin, TX'` (or `--lat`/`--lon`, optionally `--radius` in meters). Every search runs from one fixed location (otherwise the capital of the `--gl` country), so repeats and later pages are consistent, and `--gl` defaults to that location's country. Not sure of the name? `serp-locations austin` lists matches (English names), most populous first; pass a result's `canonical_name` (or `id`) as `--location`. An unknown location is a 400 (exit 3, not charged). Don't `html` a google.com search URL and parse it yourself — `serp` is cheaper, more reliable, and already parsed. Then feed the `link`s you care about into `text`/`ask`/`extract`.

**Want the page's fields already parsed, without naming them yourself**? → try `data <url>`. It works for any public web page and returns `{ request_parameters: { url, provider, type }, parse_status, data }`, where `provider` is the site the page belongs to (e.g. `toscrape.com`) and `type` the kind of page (e.g. `product`); fields are snake_case, `null` for what the page doesn't show. Some popular sites have dedicated parsers; for other sites, the first request for a new kind of page also has an AI model learn the page's structure, so it can take up to about 45 seconds; afterwards pages of that kind on that site return data straight away. If learning takes longer (or another request is already learning that site), the command fails with `(HTTP 503)` and the message "We're still processing the data structure of this site. Retry in about 30 seconds…" on stderr (exit 7, not charged): run the same command again after about 30 seconds, which usually returns the data. If the page has no structured data (empty page, login wall), it's a 422 `structure_unavailable` (not charged, exit 7) — use `extract` instead. Add `--transcript` on a video page of a site with a dedicated parser to also fetch its transcript into `data.transcript` (null when no matching captions are available; `--transcript-language de` picks the caption language, otherwise English, then the first track). If the transcript fetch itself fails, the whole request fails with a 500 (exit 7) and is not charged — retry without `--transcript` if you only need the metadata. When you need specific fields `data` doesn't return, `extract`/`ask`/`text` are the fallback.

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

# Two pages of local results as searched from Austin, TX
webscraping-ai serp coffee machines --location 'Austin, TX' --pages 2

# Look up the exact location name first (free)
webscraping-ai serp-locations austin --limit 3 --no-pretty | jq -r '.[0].canonical_name'

# Search, then read the top result
webscraping-ai serp "rust async runtime comparison" --no-pretty | jq -r '.organic_results[0].link' \
  | webscraping-ai text -

# Structured data for any public page
# -> { "request_parameters": { "provider": "toscrape.com", "type": "product", ... }, "parse_status": "ok",
#      "data": { "title": "A Light in the Attic", "price": 51.77, "currency": "GBP", ... } }
webscraping-ai data 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' --no-pretty | jq '.data.title'

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
- **`serp` is billed per results page returned** (see https://webscraping.ai/docs#serp; failed searches aren't charged) and returns at most 10 organic results per page. `position` restarts at 1 on every page, except with `--pages` > 1, where it counts through the combined list and each result has a `page` field. Use only one of `--location`, `--lat`+`--lon` or `--uule`; the server rejects other combinations with a 400 (not charged). Optional fields (`snippet`, `date`, `related_searches`, `pagination.next`, `search_information.total_results`) may be absent.
- **`data` pricing** (see https://webscraping.ai/docs#data): priced per request. `parse_status` `parse_failed` (fetched but not parsed; `data` may be `null` or partial) and `not_found` are charged. The 503 `structure_processing` answer (exit 7), the 422 `structure_unavailable` (exit 7), HTTP 400 rejections (exit 3), redirects to another site (500 `target_redirect`, exit 7) and failed fetches aren't charged. `--transcript` can turn an otherwise successful request into a refunded 500 (exit 7) when the transcript fetch fails. The shape of `data` differs per `provider`/`type`, and both are open sets.
- **API key in URL.** The CLI sends the key as a query-string param. Don't log full requests in shared logs.
- **Exit codes** are stable per error class (auth → 4, payment → 5, rate-limit → 6, server → 7, timeout → 8, connection → 9). Script around them.

## Output handling

- Text/HTML responses print verbatim. JSON responses pretty-print on a TTY and single-line on a pipe.
- `--output FILE` writes the result to a file instead of stdout.
- For batched stdin input, each URL's response is emitted in order, separated by newlines. `-o FILE` is truncated when the batch starts and collects all of them. A batch **stops at the first failing item** (same for every command, `data -` included): the results before it are already written, the rest of the list is not processed, and the exit code is that error's. Split the list or loop per URL in the shell if you need to keep going past failures. URL lists skip `#` comment lines; `serp -` skips only blank lines, so `#hashtag` queries are searched.
- `serp --page`, `--pages` and `--radius` must be integers >= 1 (server rejects `--page` > 100, `--pages` > 5 and `--page` + `--pages` - 1 > 100 with a 400, not charged) and `--lat`/`--lon` plain decimals (`--lat -33.86` works); anything else exits with code 2 before any request. `serp-locations` prints a JSON array; `--limit` is 1–10, and it has no stdin mode (`serp-locations -` exits 2).

## See also

- API documentation: <https://docs.webscraping.ai>
- Source / issues: <https://github.com/webscraping-ai/webscraping-ai-cli>
