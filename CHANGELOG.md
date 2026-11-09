# Changelog

## v2.0.0 — 2026-11-08
- Fixed (2026-11-09): scheduled Telegram bot is now wired up — new
  `.github/workflows/telegram-bot.yml` runs `bot-v2/` every 30 minutes
  (08:31–00:01 IST) once the `BOT_ENABLED` variable is `true`; dedupe
  (`bot-v2/data/posted.json`) + price history (`bot-v2/data/prices.json`)
  persist through the Actions cache. Dry-run via workflow_dispatch is now
  honoured by the bot: it prints instead of sending and saves no state
  (previously no `DRY_RUN` handling existed at all). A missing session
  cookie now fails the run loudly instead of silently posting nothing.
- Fixed (2026-11-09): install page no longer calls the drag button
  “PriceDrop Hunter” or tells phones to name the bookmark “PriceDrop” —
  both now read “Zepto Deals”, matching the install button and the README.
- Fixed (2026-11-09): install button now reads “Zepto Deals” instead of the generic “PriceDrop Hunter”, so the dragged bookmark is named after this store instead of colliding with every other tool.
- Fixed (2026-11-09): highest-discount items no longer vanish before any filter sees them — string prices ("₹1,999"), discounts as "95%" / 0.95, max-only listings (MRP + discount, no selling price), free (₹0) items, and RSC items with only `sellingPrice` or only MRP + discount now all parse (regression fixtures `fixtures/sample-high-discount.json` + `sample-high-discount-rsc.html`, 8/8 BFF + 3/3 RSC, 100%-off item sorts first); Sorter mode no longer deletes out-of-stock cards from the page it sorts. Same fix mirrored in `bot-v2/`.

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
  Dals, Rice plus Blockbuster Deals; dedupe + price-history JSON files with
  "Lowest ever" / "Price drop" tags; scheduled one-shot runs via the GitHub
  Actions workflow (`.github/workflows/telegram-bot.yml`, every 30 minutes).
- Blank-results fix: a page of already-seen items no longer ends a category
  scan early; BFF + RSC parsers share one normaliser that never drops a
  product for a missing image or brand.
- Empty-state diagnostics (logged-out / rate-limited / no location /
  category-empty) and an in-browser self-test button.
- JSON export added alongside CSV; depth up to 20 BFF pages per sub-category,
  3 parallel scan workers, de-dupe across pages.
- Regression test `test-results-tab.js` (BFF 6 + RSC 5 = 11 cards) and bot
  price-history test; `node build.js` rebuilds `dist/` (incl. sorter builds).
