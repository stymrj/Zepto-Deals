# Changelog

## v2.0.0 — 2026-11-08

### Zepto-Deals

- Fetch layer rewritten: BFF gateway first (`POST bff-gateway.zepto.com/lms/api/v2/get_page`,
  signed headers, `x-without-bearer: true` fixing the 401), Next.js RSC fallback
  (`rsc: 1`, redirect-following) for category and search pages.
- Live category/sub-category discovery from `/pip/all-categories/9277` and each
  category page's tab bar (cached 7 days); Blockbuster Deals pinned at the top.
- Live search added (BFF search up to 4 pages, RSC fallback; multi-keyword:
  phrase first, then per-word search merged and deduped).
- Sorter mode added: reorders products on the Zepto page by discount or price
  (PC dock + mobile FAB), standalone in `src/sorter.js` / `dist/zepto-sorter.user.js`.
- New Telegram bot `bot-v2/` (Node, no dependencies): watches Atta, Oil, Ghee,
  Dals, Rice plus Blockbuster Deals; dedupe + price-history DB with
  "Lowest ever" / "Price drop" tags; scheduled one-shot runs via cron.
- Blank-results fix: a page of already-seen items no longer ends a category
  scan early; BFF + RSC parsers share one normaliser that never drops a
  product for a missing image or brand.
- Empty-state diagnostics (logged-out / rate-limited / no location /
  category-empty) and an in-browser self-test button.
- JSON export added alongside CSV; depth up to 20 BFF pages per sub-category,
  3 parallel scan workers, de-dupe across pages.
- Regression test `test-results-tab.js` (BFF 6 + RSC 5 = 11 cards) and bot
  price-history test; `node build.js` rebuilds `dist/` (incl. sorter builds).

## Swiggy-Instamart-Deals

- Fetch layer rewritten: active API scan replaces capture-only mode — collection
  items (GET), category-listing filter (POST, discount high to low), category
  listing (GET); `matcher` / `x-build-version` / `x-device-id` headers; store
  ids auto-detected from the tab (URL, performance entries, page state, storage).
- 16 categories (fresh, staples, oils, NOICE collections and more) scanned in
  parallel (3 workers) with de-dupe across pages; smart page 2 when page 1
  ends above 50% off with 15+ items.
- Fallbacks: filter POST → listing GET → passive capture of the page's own loads.
- Retry with exponential backoff + jitter on 429/403/5xx (max 3 attempts).
- New Telegram bot `bot-v2/` (Node, no dependencies): 8 campaigns, dedupe +
  price-history DB with "Lowest ever" / "Price drop" tags; scheduled one-shot
  runs via cron. Needs the user's own Swiggy cookie + store ids.
- Blank-results fix: a page of already-seen items no longer ends a scan early;
  one tolerant parser for cards, listings and page state (incl. `{units, nanos}`
  prices).
- Empty-state diagnostics (no store / rate-limited / session expired /
  category-empty) and an in-browser self-test button.
- JSON export added alongside CSV.
- Regression test `test-results-tab.js` (cards 6 + listing 2 = 8 cards) and bot
  price-history test; `node build.js` rebuilds `dist/` and `index.html`.
