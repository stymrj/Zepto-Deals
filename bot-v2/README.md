# Zepto deals bot v2

Telegram bot that scans Zepto's staples sub-categories — **Atta, Oil, Ghee,
Dals, Rice** — plus Blockbuster Deals, and posts new deals to Telegram.

## How it works

- `src/zeptoApi.js` calls the BFF gateway
  (`POST bff-gateway.zepto.com/lms/api/v2/get_page`, paginated via
  `nextPageParams` until `endOfPage`) with signed headers: `x-without-bearer:
  true` when unauthenticated, SHA-256 request signature with the XSRF token
  as the secret. If the BFF call fails, the bookmarklet's RSC fallback is the
  browser-side equivalent — this bot only uses the BFF path.
- Sub-category IDs for the 5 staples are discovered live from the parent
  category page's tab bar (`discoverSubId`); if discovery fails the bot
  falls back to the parent Atta, Rice, Oil & Dals page.
- `src/bot.js` dedupes against `data/posted.json` (a deal is posted once)
  and sends at most the top 10 new deals per run, best discount first.

## Setup

```bash
cp .env.example .env   # fill in your own token, chat ID and Zepto cookie
node src/bot.js
```

No dependencies (Node 18+). Run it on a schedule with cron; it is a
one-shot run, not a daemon.

| Variable | Where it comes from |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | @userinfobot, after pressing Start in your bot |
| `ZEPTO_COOKIE` | Your own logged-in Zepto tab (DevTools → Application → Cookies). Must include `store_id` and `XSRF-TOKEN`. |
| `ZEPTO_XSRF_TOKEN` | Same cookie value, copied out separately |
| `ZEPTO_LAT` / `ZEPTO_LNG` | Your delivery location (defaults: Bengaluru) |
| `MIN_DISCOUNT` | Minimum discount to post (default 50; per-sub-category floors in `config.json`) |

## Limits (read before running)

- The BFF gateway needs **your own session cookie**. Without it every call
  returns 401 and nothing is posted. Cookies expire — refresh `.env` when
  the bot starts posting nothing.
- Zepto can change its API or block server IPs at any time. The browser
  bookmarklet (which runs inside your own Zepto tab) is the reliable path;
  this bot is a convenience, not a guarantee.
- Never share your `.env` or cookie — it is your Zepto session.
