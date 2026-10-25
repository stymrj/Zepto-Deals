# PriceDrop Hunter for Zepto

Scans the Zepto categories you pick, including their sub-categories, and shows the biggest discounts first. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Zepto-Deals/

## Features

- Asks which categories to scan, then shows the biggest discounts first
- Best deals of each category in one swipeable row, with See all
- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the button to your bookmarks bar. Open zepto.com and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**. It is a bookmark of about 380 characters that loads the latest version from GitHub Pages, so it fits on any phone. Create a bookmark, paste it as the address, and run it from the address bar on zepto.com. The full bookmarklet (about 45 KB, no network needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/zepto-deals.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every zepto.com page.

## Keyboard shortcuts

`/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. In Hunter's sidebar, open **Telegram alerts**, paste the token and chat ID, press **Send test message**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## How it gets data

Zepto renders products into its own pages. Hunter fetches those pages from your tab, the way your browser would, and reads the products embedded in them. It never calls private endpoints or alters requests.

## Limitations

- Set your Zepto delivery location first; prices and stock are local.
- Each sub-category page lists Zepto's featured products for it, not every product.
- Zepto can change its pages at any time.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
