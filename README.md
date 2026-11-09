# PriceDrop Hunter for Zepto — v2.0.0

Scan Zepto categories for the biggest discounts, in your own browser as a
bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Zepto-Deals/

## What it does

- Asks which categories to scan, then shows the biggest discounts first —
  top deals overall plus the best of each category in a swipeable row
- Live search: type a phrase (or several words) and Hunter searches Zepto
  for it, best discount first
- **Sorter mode:** reorders the products already on the Zepto page itself
  (highest discount, tap again for lowest price). PC dock and mobile FAB
  versions ship standalone as `dist/sorter.js` / `dist/zepto-sorter.user.js`
- Labels products that are new, cheaper than last time, or at their lowest
  price ever, with a price-history sparkline on every product seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever,
  best value
- Filters: search, category, brand, maximum price, minimum discount, stock,
  saved items · Shopping list with quantities, total and total savings
- CSV and JSON export · Grid and list views, light and dark themes,
  keyboard shortcuts · Settings, saved items and price history stay in
  your browser

## Why v2 is stronger

- **Two fetch paths, not one.** The BFF gateway
  (`POST bff-gateway.zepto.com/lms/api/v2/get_page`, signed headers with
  `x-without-bearer: true` so a missing bearer no longer 401s) is tried
  first; the Next.js RSC fallback (`rsc: 1`, redirect-following) covers
  search and category pages when the BFF call fails or has no session.
- **Live category discovery.** Categories come from
  `/pip/all-categories/9277` and sub-categories from each category page's
  tab bar (cached 7 days), with Blockbuster Deals pinned at the top —
  instead of only the seeded list. Up to 20 BFF pages per sub-category.
- **Deeper, parallel scans.** 3 workers scan categories in parallel, with
  de-dupe across pages; a page of already-seen items no longer ends a
  category scan early (that was the blank-results bug).
- **It tells you why 0 results.** The empty screen diagnoses logged-out /
  rate-limited / no delivery location / empty category, and a **Run
  self-test** button checks the parsers on sample data in the tab.
- **Bot with a memory.** `bot-v2/` watches Atta, Oil, Ghee, Dals and Rice
  plus Blockbuster Deals, dedupes, and keeps a price history so alerts say
  "Lowest ever" / "Price drop ₹X → ₹Y" (see `bot-v2/README.md`).
- **Highest discounts no longer vanish (2026-11-09).** The parser used to
  drop the deepest-discount items before any filter saw them: prices sent as
  formatted strings ("₹1,999"), discounts sent as "95%" or 0.95, listings
  with only an MRP + discount, free (₹0) items, and RSC items with no
  `discountedSellingPrice` key. All of those now parse (see
  `fixtures/sample-high-discount.json`), and Sorter mode no longer deletes
  out-of-stock cards from the page it sorts.
- Hunter-only strengths the baseline never had: price history + lowest-ever,
  saved-item tracking with sparklines, unit-price sort, CSV/JSON export.
- **Bookmark name fixed (2026-11-09):** the install button now reads **Zepto Deals** instead of the generic “PriceDrop Hunter”, so the bookmark you drag to your bookmarks bar is named after this store.

## Install

![Install walkthrough](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.gif)

[Watch the walkthrough video (MP4)](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.mp4)

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the **Zepto Deals** button to your bookmarks bar. Open zepto.com and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**.
It is a bookmark of about 380 characters that loads the latest version from
GitHub Pages. Create a bookmark named **Zepto Deals**, paste it as the address, and run it from
the address bar on zepto.com. The full bookmarklet (about 74 KB, no network
needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/zepto-deals.user.js` in Tampermonkey or
Violentmonkey. A small Deals button appears on every zepto.com page.
Install `dist/zepto-sorter.user.js` for the standalone sorter.

## Use

1. Open zepto.com and set your delivery location.
2. Open Hunter, press **Choose & scan**, pick categories, press Scan.
3. Use **Sorter mode** to reorder the Zepto page itself, or type in the
   search box to filter scanned deals — or run a live search from the
   console with `window.__ZPT__.search('atta')`.
4. Heart a deal to save it; **Add to list** builds a shopping list.

Keyboard shortcuts: `/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your
Telegram (in-browser alerts, set up in Hunter's top bar):

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`.
4. On the store, open Hunter, press **Telegram** in the top bar, paste the
   token and chat ID, press **Send test**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the
userscript for alerts: some shops block bookmarklets from calling Telegram,
while the userscript sends through `GM_xmlhttpRequest`. The token is stored
only in your browser.

## Bot setup (scheduled Telegram alerts)

`bot-v2/` is a separate Node bot (no dependencies, Node 18+) that also runs
on its own, without a browser, on GitHub Actions — see
`.github/workflows/telegram-bot.yml`. Every 30 minutes (08:31–00:01 IST) it
scans the staples sub-categories plus Blockbuster Deals, compares with the
previous run, and sends new deals to Telegram. It needs your own Zepto
session cookie — see `bot-v2/README.md` and `bot-v2/.env.example`.

1. Fork [github.com/stymrj/Zepto-Deals](https://github.com/stymrj/Zepto-Deals).
2. Create a bot with `@BotFather` (`TELEGRAM_BOT_TOKEN`) and get your chat
   ID from `@userinfobot` (`TELEGRAM_CHAT_ID`).
3. On zepto.com while logged in, copy the Cookie header from DevTools →
   Network (`ZEPTO_COOKIE` — must include `store_id` and `XSRF-TOKEN`) and
   copy the `XSRF-TOKEN` value out separately (`ZEPTO_XSRF_TOKEN`).
4. In your fork, add those four as **Secrets** (Settings → Secrets and
   variables → Actions), and set the **Variable** `BOT_ENABLED` = `true`.
5. In **Actions**, enable workflows, run **Telegram deal alerts** with
   **Print the messages instead of sending them** ticked to preview, then
   run it again for real.

Optional variables: `MIN_DISCOUNT` (default 50), `ZEPTO_STORE_ID`,
`ZEPTO_DEVICE_ID`, `ZEPTO_LAT` / `ZEPTO_LNG` (default Bengaluru 12.9716,
77.5946 — set these to your delivery location, or the bot scans for the
wrong city).

Local run: `cp bot-v2/.env.example bot-v2/.env`, then
`node bot-v2/src/bot.js --dry-run` (prints, sends nothing, saves no state)
or `node bot-v2/src/bot.js`. Node 18+, no `npm install` needed.

Dedupe (`bot-v2/data/posted.json`) and price history
(`bot-v2/data/prices.json`) persist between scheduled runs through the
Actions cache — if the cache is ever lost, the bot may re-post deals it
already sent. A dry run never writes either file.

A session cookie works like your password for that site. Keep it only in
GitHub **Secrets** or your local `.env` (already in `.gitignore`), never in
a commit or an issue. If one ever leaks, log out of all devices on Zepto to
cancel it. Cookies expire; when the bot reports that Zepto refused the
session (401), copy a fresh one.

## Troubleshooting

- **No products / "session expired".** Reload zepto.com and log in again
  if asked, then scan. The BFF calls need your tab's session.
- **"Rate-limited".** Wait a minute or two, then scan fewer categories.
- **"No delivery location set".** Choose your delivery location on
  zepto.com first — Zepto shows no products without one.
- **"No deals in these categories".** Try more categories or lower the
  minimum discount in the menu.
- **Still stuck?** Press **Run self-test** in the sidebar: it checks the
  parsers on sample data. If it passes, the problem is the live session or
  location, not the code.
- **Scheduled bot posts nothing / 401 in the Actions log.** The session
  cookie expired — copy a fresh `ZEPTO_COOKIE` (and `ZEPTO_XSRF_TOKEN`)
  into Secrets. The run now fails loudly instead of staying green.
- **Scheduled runs never start.** Set the repository variable
  `BOT_ENABLED` to `true` (Settings → Secrets and variables → Actions →
  Variables). Manual workflow runs always work, even with the variable off.
- **Bot run fails "no session cookie".** The `ZEPTO_COOKIE` secret is
  missing — add it (step 3 above).
- **Bot shows another city's deals.** The bot defaults to Bengaluru
  (12.9716, 77.5946) — set the `ZEPTO_LAT` / `ZEPTO_LNG` variables to your
  delivery location.
- **403/429 in the Actions log.** Zepto rate-limited the GitHub IP — wait
  for the next run. The bookmarklet in your own tab is the reliable path.
- Zepto can change its pages/APIs at any time; the RSC fallback and the
  loose widget parser are there to survive small changes.

## Testing

```bash
node test-results-tab.js            # parser regression: 11 sample products must render as 11 cards
node test-bookmark-name.js          # install button reads "Zepto Deals" in template + built page
node bot-v2/test-price-history.js   # bot price-history: drops + lowest-ever
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/telegram-bot.yml'))"   # workflow parses
node build.js                       # rebuilds dist/ and index.html
```

The regression test loads the real parsers from `src/deals.js` and feeds
them a BFF widget payload (`fixtures/sample-bff.json`, 6 of 7 items) and an
RSC page (`fixtures/sample-rsc.html`, 5 items), plus the sorter read and
the diagnostics/self-test checks. Live Zepto APIs are **not** verified by
these tests — they need a manual browser test on zepto.com.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/sorter.js        standalone sorter (PC dock + mobile FAB)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
bot-v2/              Telegram bot (BFF client, staples config, price history)
.github/workflows/   telegram-bot.yml (every 30 minutes, 08:31–00:01 IST)
test-results-tab.js  parser regression test
fixtures/            sample BFF + RSC payloads
```

Run `node build.js` after any change.

## License

MIT — see `LICENSE`. The BFF client code in v2.0.0 adapts an
MIT-licensed reference implementation; its original MIT notice is appended
in `LICENSE`.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
