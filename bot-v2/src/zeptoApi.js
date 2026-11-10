// Zepto BFF client for the Telegram bot (Node 18+, no dependencies).
// Same API shape as the bookmarklet: POST bff-gateway.zepto.com/lms/api/v2/get_page
// with signed headers (SHA-256 over sorted body|deviceId|method|requestId|
// secret|url, secret = XSRF token, x-without-bearer when unauthenticated).
// Deals come only from the BFF path. The Next.js RSC fetch in this file is
// used solely to discover sub-category ids (discoverSubId) — it is not a
// deals fallback; the bookmarklet's RSC fallback is browser-only. Adapted
// from the MIT-licensed reference implementation; see LICENSE.
// Needs a real user session: set ZEPTO_COOKIE (with store_id + XSRF-TOKEN)
// and ZEPTO_XSRF_TOKEN from your own logged-in Zepto tab. Without them the
// BFF calls return 401 and only the RSC fallback is attempted.
const crypto = require('crypto');
const BFF = 'https://bff-gateway.zepto.com';
const SITE = 'https://www.zepto.com';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
function cookieVal(name) {
  const c = process.env.ZEPTO_COOKIE || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function envHeaders() {
  const xsrf = process.env.ZEPTO_XSRF_TOKEN || cookieVal('XSRF-TOKEN');
  const csrf = cookieVal('csrfSecret'), storeId = process.env.ZEPTO_STORE_ID || cookieVal('store_id');
  const deviceId = process.env.ZEPTO_DEVICE_ID || uuid(), sessionId = cookieVal('session_id') || uuid();
  const h = { accept: 'application/json, text/plain, */*', app_sub_platform: 'WEB', app_version: '17.6.0', appversion: '17.6.0', auth_from_cookie: 'true', auth_revamp_flow: 'v2', marketplace_type: 'SUPER_SAVER', platform: 'WEB', source: 'DIRECT', tenant: 'ZEPTO', device_id: deviceId, deviceid: deviceId, session_id: sessionId, sessionid: sessionId, 'x-without-bearer': 'true' };
  if (storeId) { h.store_id = storeId; h.storeid = storeId; h.store_ids = storeId; }
  if (xsrf) h['x-xsrf-token'] = xsrf;
  if (csrf) h['x-csrf-secret'] = csrf;
  if (process.env.ZEPTO_COOKIE) h.cookie = process.env.ZEPTO_COOKIE;
  return h;
}
function signedHeaders(method, urlPath, bodyStr) {
  const base = envHeaders();
  const reqId = uuid(), deviceId = base.device_id;
  const xsrf = base['x-xsrf-token'] || '';
  const params = { body: bodyStr || '', deviceId, method: method.toLowerCase(), requestId: reqId, secret: xsrf, url: urlPath };
  const sig = sha256(Object.keys(params).sort().map(k => params[k]).join('|'));
  const h = Object.assign({}, base, { 'content-type': 'application/json', 'request-signature': sig, 'x-timezone': sha256(sig), request_id: reqId, requestid: reqId, requestId: reqId });
  if (!h.authorization) h['x-without-bearer'] = 'true';
  return h;
}
const slugify = s => String(s || '').toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function imageUrl(p) {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  const c = p.replace(/^\/+/, '');
  if (c.startsWith('production/')) return 'https://cdn.zeptonow.com/' + c;
  if (!c.includes('/')) return 'https://cdn.zeptonow.com/production/tr:w-360,f-auto,q-70/cms/product_variant/' + c;
  return 'https://cdn.zeptonow.com/production/tr:w-360,f-auto,q-70/' + c;
}
// Prices arrive in paise as numbers; a few widgets send them as formatted
// strings ("₹1,999"). Numbers are paise (/100); strings carry their own unit,
// so a string with ₹ / commas / decimals is read as rupees, while a bare-digit
// string behaves like the number form (paise). Same fix as the bookmarklet:
// reading a string with /100 gave NaN (₹) and dropped the item outright.
function zeptoPaise(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v / 100 : 0;
  const s = String(v).trim();
  if (!s) return 0;
  if (/[₹,]/.test(s) || /\.\d/.test(s)) { const m = s.replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; }
  const n = +s;
  return isFinite(n) ? n / 100 : 0;
}
// Discount percent from the payload, in whatever shape it arrives: number 85,
// string "85" / "85%", or fraction 0.85. Null when absent/unreadable.
function zeptoDiscPct(v) {
  if (v == null) return null;
  let n;
  if (typeof v === 'number') n = v;
  else { const m = String(v).match(/\d+(\.\d+)?/); if (!m) return null; n = +m[0]; }
  if (!isFinite(n)) return null;
  if (n > 0 && n < 1) n *= 100; // fraction form, e.g. 0.85 = 85%
  return Math.round(n);
}
function normalize(it, cat, sub) {
  const p = it.product || (it.productResponse && it.productResponse.product) || it;
  const v = it.productVariant || (it.productResponse && it.productResponse.productVariant) || it;
  if (!p || !p.name) return null;
  const rawSell = it.discountedSellingPrice != null ? it.discountedSellingPrice : it.sellingPrice != null ? it.sellingPrice : v.discountedSellingPrice != null ? v.discountedSellingPrice : v.sellingPrice;
  const rawMrp = it.mrp != null ? it.mrp : it.maximumRetailPrice != null ? it.maximumRetailPrice : v.mrp != null ? v.mrp : v.maximumRetailPrice;
  const hasSell = rawSell != null;
  let sell = zeptoPaise(rawSell);
  let mrp = zeptoPaise(rawMrp);
  const discExplicit = zeptoDiscPct(it.discountPercent != null ? it.discountPercent : v.discountPercent);
  // No selling price at all: derive it from MRP + the payload's own discount.
  // A ₹0 selling price with an MRP is a genuine free item, not a missing price.
  if (!hasSell && mrp > 0 && discExplicit) sell = +(mrp * (1 - discExplicit / 100)).toFixed(2);
  if (!sell && !(hasSell && mrp > 0)) return null;
  if (!(mrp >= sell)) mrp = sell;
  const oos = it.outOfStock === true || v.outOfStock === true || it.availableQuantity === 0 || v.quantity === 0;
  let disc = mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0;
  if (!disc && discExplicit) disc = discExplicit;
  const img = (v.images && v.images[0] && (v.images[0].path || v.images[0].name)) || (p.images && p.images[0] && (p.images[0].path || p.images[0].name)) || '';
  const slug = p.slug || slugify(p.name);
  return { id: String(it.id || v.id || p.id), title: p.name + (v.formattedPacksize ? ' · ' + v.formattedPacksize : ''), brand: String(p.brand || ''), price: sell, mrp, disc, save: +(mrp - sell).toFixed(2), img: imageUrl(img), url: v.id ? `${SITE}/pn/${slug}/pvid/${v.id}` : `${SITE}/pn/${slug}`, inStock: !oos, cat: cat + (sub ? ' › ' + sub : '') };
}
function extractWidgets(widgets, cat, sub, requireDiscount) {
  const out = [], seen = new Set();
  (function walk(list) {
    if (!Array.isArray(list)) return;
    for (const w of list) {
      if (!w) continue;
      const items = (w.data && Array.isArray(w.data.items)) ? w.data.items : (w.data && Array.isArray(w.data.products)) ? w.data.products : Array.isArray(w.items) ? w.items : [];
      for (const it of items) { const n = normalize(it, cat, sub); if (!n || seen.has(n.id)) continue; seen.add(n.id); if (requireDiscount && !(n.disc > 0)) continue; out.push(n); }
      if (w.widgets) walk(w.widgets);
      if (w.data && w.data.widgets) walk(w.data.widgets);
    }
  })(widgets);
  return out;
}
async function fetchBffPage(body) {
  const path = '/lms/api/v2/get_page', bodyStr = JSON.stringify(body);
  const r = await fetch(BFF + path, { method: 'POST', headers: signedHeaders('POST', path, bodyStr), body: bodyStr, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('BFF HTTP ' + r.status);
  return r.json();
}
async function getDeals(categoryId, subCategoryId, catName, subName, maxPages) {
  const lat = +(process.env.ZEPTO_LAT || '12.9716'), lon = +(process.env.ZEPTO_LNG || '77.5946');
  let body = { page_type: 'SUBCATEGORY', version: 'v2', latitude: lat, longitude: lon, category_id: categoryId, subcategory_id: subCategoryId, page_size: 20, page_identifier: 'browse_category_product', filter_id: '0', subcategory_intent_id: '0', ads_end_range: 0, ads_start_range: 0, atlas_offset: 0, disable_tabs: true, eta_raining: false, infinite_feed_widget_id: 0, is_continuous_feed: true, last_widget_id: 0, oos_end_range: 0, oos_start_range: 0, page_number: 1 };
  const out = [];
  for (let page = 1; page <= (maxPages || 5); page++) {
    if (page > 1) await sleep(500 + Math.random() * 700);
    let data; try { data = await fetchBffPage(body); } catch (e) { break; }
    out.push(...extractWidgets((data.pageLayout && data.pageLayout.widgets) || [], catName, subName, true));
    const end = data.pageLayout && data.pageLayout.endOfPage, next = data.pageLayout && data.pageLayout.nextPageParams;
    if (end || !next) break;
    body = Object.assign({}, body, next);
  }
  return out;
}
// Discover a sub-category id by title from the parent category page's tab bar.
async function discoverSubId(parent, title) {
  try {
    const r = await fetch(`${SITE}/cn/${slugify(parent.name)}/all/cid/${parent.categoryId}/scid/${parent.subCategoryId}`, { headers: { accept: '*/*', rsc: '1' }, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    const m = new RegExp('"title":"' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^}]*"category_id":"([0-9a-f-]{36})"[^}]*"subcategory_id":"([0-9a-f-]{36})"').exec(text);
    if (m) return { categoryId: m[1], subCategoryId: m[2] };
    const m2 = new RegExp('"title":"' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]{0,400}?"subcategory_id":"([0-9a-f-]{36})"').exec(text);
    if (m2) return { categoryId: parent.categoryId, subCategoryId: m2[1] };
  } catch (e) { /* fall through */ }
  return null;
}
module.exports = { getDeals, discoverSubId, extractWidgets, normalize };
