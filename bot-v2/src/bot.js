// Zepto deals Telegram bot (Node 18+, no dependencies).
// Scans the 5 staples sub-categories (Atta, Oil, Ghee, Dals, Rice) plus
// Blockbuster Deals via the BFF gateway, dedupes against data/posted.json,
// and posts new deals >= minDiscount to Telegram with plain fetch.
// Run once:  node src/bot.js        Run on a schedule: cron / GitHub Actions.
// Needs .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ZEPTO_COOKIE (your own
// logged-in Zepto session cookie, with store_id + XSRF-TOKEN), ZEPTO_XSRF_TOKEN.
// Without a session cookie the BFF calls return 401 and nothing is posted,
// so the bot exits non-zero instead of silently succeeding (see main()).
// Dry run: node src/bot.js --dry-run, or DRY_RUN=true — prints the messages
// instead of sending them and saves no state (no dedupe/price-history writes).
const fs = require('fs'), path = require('path');
const { getDeals, discoverSubId } = require('./zeptoApi');
const { record } = require('./priceHistory');
const config = require('../config.json');
const DRY = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'posted.json');
const PRICES = path.join(ROOT, 'data', 'prices.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function loadPosted() { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return {}; } }
function loadPrices() { try { return JSON.parse(fs.readFileSync(PRICES, 'utf8')); } catch (e) { return {}; } }
function savePrices(h) { fs.mkdirSync(path.dirname(PRICES), { recursive: true }); fs.writeFileSync(PRICES, JSON.stringify(h, null, 2)); }
function savePosted(p) { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(p, null, 2)); }
async function tgSend(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (DRY || !token || !chat) { console.log('[dry-run] message was:\n' + text.replace(/<[^>]+>/g, '')); return false; }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) console.error('[telegram] HTTP', r.status, await r.text().catch(() => ''));
  return r.ok;
}
async function main() {
  if (!process.env.ZEPTO_COOKIE) { console.error('[bot] no session cookie — set ZEPTO_COOKIE (your own logged-in Zepto session cookie, with store_id + XSRF-TOKEN); without it the BFF calls return 401 and nothing is posted'); process.exit(1); }
  const minDisc = +(process.env.MIN_DISCOUNT || config.minDiscount || 50);
  const posted = loadPosted();
  const parent = config.staples.parent;
  const found = [];
  for (const sub of config.staples.subcategories) {
    const disc = await discoverSubId(parent, sub.name).catch(() => null);
    const ids = disc || { categoryId: parent.categoryId, subCategoryId: parent.subCategoryId };
    console.log(`[bot] ${sub.name}: subCategoryId ${ids.subCategoryId === parent.subCategoryId ? '(parent fallback)' : ids.subCategoryId}`);
    let items = [];
    try { items = await getDeals(ids.categoryId, ids.subCategoryId, parent.name, sub.name, 3); } catch (e) { console.error(`[bot] ${sub.name} failed:`, e.message); }
    for (const p of items) if (p.disc >= Math.max(minDisc, sub.minDiscount || 0) && p.inStock && !posted[p.id]) found.push(p);
    await sleep(800 + Math.random() * 800);
  }
  // Blockbuster Deals hub.
  try {
    const bb = config.blockbuster;
    const items = await getDeals(bb.categoryId, bb.subCategoryId, 'Blockbuster Deals', 'Top Picks', 3);
    for (const p of items) if (p.disc >= minDisc && p.inStock && !posted[p.id]) found.push(p);
  } catch (e) { console.error('[bot] Blockbuster failed:', e.message); }
  found.sort((a, b) => b.disc - a.disc || b.save - a.save);
  const prices = loadPrices();
  for (const item of found) { const r = record(prices, item.id, item.price); item.prevPrice = r.previous; item.isDrop = r.isDrop; item.lowestEver = r.isLowestEver; }
  if (DRY) console.log('[dry-run] price history not saved'); else savePrices(prices);
  console.log(`[bot] ${found.length} new deals >= ${minDisc}%`);
  const top = found.slice(0, 10);
  for (const p of top) {
    const tags = [p.lowestEver ? 'Lowest ever' : '', p.isDrop && p.prevPrice != null ? `Price drop ₹${p.prevPrice} → ₹${p.price}` : ''].filter(Boolean).join(' · ');
    const msg = `<b>${p.disc}% off</b> · ${esc(p.title)}${tags ? `\n${esc(tags)}` : ''}\n₹${p.price} <s>₹${p.mrp}</s> · save ₹${p.save}\n${esc(p.cat)}${p.url ? `\n<a href="${esc(p.url)}">Open on Zepto</a>` : ''}`;
    if (await tgSend(msg)) posted[p.id] = p.price;
    await sleep(400);
  }
  // Mark the rest as seen so the next run does not re-post them.
  // (Skipped on dry runs: a preview must not consume dedupe state.)
  if (!DRY) for (const p of found.slice(10)) posted[p.id] = p.price;
  if (DRY) console.log('[dry-run] dedupe state not saved'); else savePosted(posted);
  console.log('[bot] done');
}
main().catch(e => { console.error(e); process.exit(1); });
