# Zepto deals bot v2

Telegram bot that scans Zepto's staples sub-categories — **Atta, Oil, Ghee,
Dals, Rice** — plus Blockbuster Deals, and posts new deals to Telegram.

## How it works

- `src/zeptoApi.js` calls the BFF gateway
  (`POST bff-gateway.zepto.com/lms/api/v2/get_page`, paginated via
  `nextPageParams` until `endOfPage`) with signed headers: `x-without-bearer:
  true` when unauthenticated, SHA-256 request signature with the XSRF token
  as the secret. Deals come only from the BFF path; the RSC fetch in this
  file only discovers sub-category ids.
- Sub-category IDs for the 5 staples are discovered live from the parent
  category page's tab bar (`discoverSubId`); if discovery fails the bot
  falls back to the parent Atta, Rice, Oil & Dals page.
- `src/bot.js` dedupes against `data/posted.json` (a deal is posted once)
  and keeps a price history in `data/prices.json` (`src/priceHistory.js`),
  so messages are tagged **Lowest ever** or **Price drop ₹X → ₹Y** when the
  history supports it. At most the top 10 new deals per run, best discount
  first. Deals come only from the BFF path — if a BFF call fails, that
  sub-category is skipped for the run (the bookmarklet's RSC fallback is
  browser-only; RSC here is used only to discover sub-category ids).

## Setup

```bash
cp .env.example .env   # fill in your own token, chat ID and Zepto cookie
node src/bot.js --dry-run   # prints the messages, sends nothing, saves no state
node src/bot.js
```

No dependencies (Node 18+). One-shot run, not a daemon.

## Scheduled runs (GitHub Actions)

`.github/workflows/telegram-bot.yml` runs the bot every 30 minutes
(08:31–00:01 IST) once the repository **variable** `BOT_ENABLED` is `true`.
Set these in Settings → Secrets and variables → Actions (see the workflow
file header and the repo README for the full steps):

- Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ZEPTO_COOKIE`,
  `ZEPTO_XSRF_TOKEN`
- Variables (optional, the bot has defaults): `MIN_DISCOUNT` (50),
  `ZEPTO_STORE_ID`, `ZEPTO_DEVICE_ID`, `ZEPTO_LAT` / `ZEPTO_LNG`
  (Bengaluru 12.9716, 77.5946)

Dedupe (`data/posted.json`) and price history (`data/prices.json`) persist
between runs through the Actions cache. To preview a run: Actions →
**Telegram deal alerts** → Run workflow → tick **Print the messages
instead of sending them** (dry-run).

| Variable | Where it comes from |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | @userinfobot, after pressing Start in your bot |
| `ZEPTO_COOKIE` | Your own logged-in Zepto tab (DevTools → Application → Cookies). Must include `store_id` and `XSRF-TOKEN`. **Required** — without it the bot exits non-zero. |
| `ZEPTO_XSRF_TOKEN` | Same cookie value, copied out separately |
| `ZEPTO_STORE_ID` | Store id, from the same cookie (`store_id`); optional — read from the cookie when unset |
| `ZEPTO_DEVICE_ID` | Optional — generated per run when unset |
| `ZEPTO_LAT` / `ZEPTO_LNG` | Your delivery location (defaults: Bengaluru) |
| `MIN_DISCOUNT` | Minimum discount to post (default 50; per-sub-category floors in `config.json`) |
| `DRY_RUN` | `true` prints the messages instead of sending them, and saves no state |

## Limits (read before running)

- The BFF gateway needs **your own session cookie**. Without it every call
  returns 401 and nothing is posted — the bot now exits non-zero so a dead
  session shows up as a failed run instead of a quiet green one. Cookies
  expire — refresh the secret when the bot starts posting nothing (or the
  Actions log shows 401).
- Zepto can change its API or block server IPs at any time. The browser
  bookmarklet (which runs inside your own Zepto tab) is the reliable path;
  this bot is a convenience, not a guarantee.
- Never share your `.env` or cookie — it is your Zepto session.
