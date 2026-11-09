// ==UserScript==
// @name         PriceDrop Hunter — Zepto Sorter
// @namespace    zepto-sorter
// @version      2.0.0
// @description  Sort the products already on a Zepto page by discount or price.
// @match        https://www.zepto.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
/*!
 * PriceDrop Hunter — Zepto Sorter (standalone, v2.0.0)
 * Sorts the products already on a Zepto page by discount or by price.
 * PC: a dock with category shortcuts + "Sort Page". Mobile: a floating
 * "Sort" button + a discount/price toggle pill.
 * Own implementation written for this project: it reads the % OFF label
 * printed on each card first (falling back to MRP vs selling price), then
 * reorders the product grid in a single DocumentFragment batch. It never
 * clones product nodes (so Add-to-cart keeps working) and opens products in
 * a new tab so the Zepto session is preserved.
 * Runs in your own browser as a bookmarklet or userscript on zepto.com.
 * Usage: run it on any Zepto category/search page, tap a category (PC) or
 * Sort (mobile), then tap the % Off / Price pill to switch the sort.
 */
(function () {
  'use strict';
  if (window.__ZPT_SORTER__) { window.__ZPT_SORTER__.toggle(); return; }
  const isMobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  // Staples first: the five sub-categories the bot also watches.
  const CATEGORIES = ['Atta', 'Oil', 'Ghee', 'Dals', 'Rice', 'Masala', 'Packaged Foods', 'Tea', 'Coffee', 'Biscuits', 'Dairy', 'Sweets', 'Snacks', 'Skincare', 'Cleaning'];
  let cached = [], grid = null, mode = 'disc'; // 'disc' = highest discount, 'price' = lowest price
  const doc = document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $all = s => Array.from(doc.querySelectorAll(s));

  // --- reading a card: label first, price pair second, tag the card ---
  function readCard(el) {
    const tx = (el.innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    // Out-of-stock cards still carry a real discount label — dropping them
    // here deleted the deepest discounts from the sorted page outright (the
    // sorter rebuilds the grid from what this returns). They sort by discount
    // like any other card; only banners / notify-me placeholders are skipped.
    if (/BANNER|NOTIFY/.test(tx) || !tx.includes('₹')) return null;
    const nums = [];
    for (const m of tx.matchAll(/₹\s*([\d,.]+)/g)) {
      const v = parseFloat(m[1].replace(/[^\d.]/g, ''));
      const ctx = m.input.substring(m.index, m.index + 20).toUpperCase();
      if (v > 5 && v < 30000 && !/MONTH|EMI/.test(ctx)) nums.push(v);
    }
    if (!nums.length) return null;
    let d = 0; const p = Math.min(...nums.slice(0, 2));
    const pct = tx.match(/(\d+)\s*%\s*OFF/), sv = tx.match(/SAVE\s*₹\s*([\d,.]+)/);
    if (pct) d = +pct[1];
    else if (sv && p !== 999999) { const s = parseFloat(sv[1].replace(/[^\d.]/g, '')); d = (s / (p + s)) * 100; }
    else if (nums.length >= 2) { const mrp = Math.max(nums[0], nums[1]), sp = Math.min(nums[0], nums[1]); if (mrp > sp && mrp <= sp * 10) d = ((mrp - sp) / mrp) * 100; }
    return { el, d, p };
  }
  function tag(item) {
    const old = item.el.querySelector('.zpt-tag'); if (old) old.remove();
    if (item.d > 0) {
      const t = doc.createElement('div'); t.className = 'zpt-tag'; t.textContent = Math.round(item.d) + '% OFF';
      t.style.cssText = 'position:absolute;top:10px;left:10px;background:#720e9e;color:#fff;font-weight:700;font-size:13px;padding:4px 6px;text-align:center;border-radius:4px;z-index:10';
      item.el.style.position = 'relative'; item.el.appendChild(t);
    }
    item.el.setAttribute('target', '_blank'); item.el.setAttribute('rel', 'noopener noreferrer');
  }
  function applySort() {
    if (!grid || !cached.length) return;
    cached.sort((a, b) => mode === 'disc' ? b.d - a.d : a.p - b.p);
    const frag = doc.createDocumentFragment();
    cached.forEach(x => frag.appendChild(x.el));
    grid.innerHTML = ''; grid.appendChild(frag);
    pill.textContent = mode === 'disc' ? '% Off ↓' : 'Price ↑';
    window.scrollTo({ top: grid.getBoundingClientRect().top + window.scrollY - 130, behavior: 'auto' });
  }
  function findGrid() {
    const links = $all('a').filter(e => (e.textContent || '').includes('₹'));
    if (!links.length) return null;
    const votes = new Map();
    links.forEach(l => { let p = l.parentElement; for (let i = 0; i < 4 && p; i++) { votes.set(p, (votes.get(p) || 0) + 1); p = p.parentElement; } });
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  async function processItems() {
    grid = findGrid();
    if (!grid) throw new Error('No items');
    const raw = Array.from(grid.querySelectorAll('a'));
    cached = [];
    for (let i = 0; i < raw.length; i++) { if ((i & 63) === 0) await wait(0); const it = readCard(raw[i]); if (it) { tag(it); cached.push(it); } }
    if (!cached.length) { alert('No items found'); return 0; }
    mode = 'disc'; pill.style.display = 'block'; applySort();
    return cached.length;
  }
  function turbo(on) {
    let t = doc.getElementById('zpt-turbo');
    if (on && !t) { t = doc.createElement('style'); t.id = 'zpt-turbo'; t.textContent = 'img{visibility:hidden!important}*{transition:none!important;animation:none!important}'; doc.head.appendChild(t); }
    else if (!on && t) t.remove();
  }
  async function scrollAndLoad() {
    window.scrollTo(0, 0); turbo(true);
    let last = 0, same = 0;
    while (same < 2) {
      const items = $all('a').filter(e => (e.textContent || '').includes('₹'));
      if (items.length) { items[items.length - 1].scrollIntoView({ block: 'start' }); await wait(1500); window.scrollBy(0, -150); }
      else window.scrollBy(0, 500);
      await wait(2000);
      const n = $all('a').length;
      if (n === last) same++; else { last = n; same = 0; }
    }
  }
  function setSearch(text) {
    const sb = doc.querySelector('input[type="text"]');
    if (!sb) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const key = { bubbles: true, key: 'Enter', keyCode: 13, which: 13 };
    sb.focus(); set.call(sb, ''); sb.dispatchEvent(new Event('input', { bubbles: true }));
    sb.dispatchEvent(new KeyboardEvent('keydown', key)); sb.dispatchEvent(new KeyboardEvent('keyup', key));
    set.call(sb, text); sb.dispatchEvent(new Event('input', { bubbles: true }));
    sb.dispatchEvent(new KeyboardEvent('keydown', key)); sb.dispatchEvent(new KeyboardEvent('keyup', key));
    return true;
  }
  async function runCategory(cat, btn) {
    loader('Search: ' + cat); if (btn) { btn.classList.add('act'); btn.textContent = '…'; }
    try {
      let sb = doc.querySelector('input[type="text"]');
      if (!sb) { const a = doc.querySelector('a[href*="search"]'); if (a) { a.click(); await wait(1500); } }
      if (!setSearch(cat)) throw new Error('No Search');
      await wait(2500); await scrollAndLoad(); await processItems();
    } catch (e) { turbo(false); alert(e.message || e); }
    loader(null); if (btn) { btn.classList.remove('act'); btn.textContent = cat; }
  }
  async function runManual(btn) {
    loader('Sorting…'); if (btn) btn.textContent = '…';
    try {
      const sb = doc.querySelector('input[type="text"]');
      if (sb && sb.value) { sb.focus(); const k = { bubbles: true, key: 'Enter', keyCode: 13, which: 13 }; sb.dispatchEvent(new KeyboardEvent('keydown', k)); sb.dispatchEvent(new KeyboardEvent('keyup', k)); await wait(1500); }
      await scrollAndLoad(); await processItems();
    } catch (e) { turbo(false); alert(e.message || e); }
    loader(null); if (btn) btn.textContent = '⚡ Sort Page';
  }

  // --- UI: PC dock, mobile FAB + toggle pill (shared loader) ---
  const style = doc.createElement('style');
  style.textContent = '.zpt-dock{position:fixed;z-index:99999;background:#fff;padding:10px;padding-top:40px;font-family:sans-serif;border-radius:12px;border:1px solid #eee;top:100px;right:20px;width:150px;box-shadow:0 0 20px #00000020}.zpt-list{max-height:60vh;overflow-y:auto}.zpt-dock.min .zpt-list{display:none}.zpt-btn{display:block;width:100%;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:8px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:#495057;text-align:left}.zpt-btn:hover{background:#ff3269;color:#fff}.zpt-btn.act{background:#720e9e;color:#fff}.zpt-btn.man{background:#f3e5f5;color:#7b1fa2;text-align:center;margin-bottom:10px;border-bottom:2px solid #e1bee7}.zpt-h{position:absolute;top:8px;width:24px;height:24px;background:#eee;color:#333;border-radius:50%;text-align:center;line-height:24px;font-size:14px;cursor:pointer;font-weight:bold}.zpt-x{right:8px}.zpt-m{right:36px}.zpt-pill{position:fixed;bottom:180px;right:20px;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;padding:8px 16px;border-radius:20px;font-family:sans-serif;font-weight:bold;font-size:12px;box-shadow:0 4px 10px rgba(0,0,0,.2);z-index:999999;display:none;cursor:pointer}.zpt-fab{position:fixed;bottom:120px;right:20px;background:#720e9e;color:#fff;padding:12px;border-radius:30px;font-family:sans-serif;font-weight:bold;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,.3);z-index:999999;display:flex;align-items:center;cursor:pointer}.zpt-fab .zpt-x2{margin-left:10px;font-size:18px;opacity:.7;padding-left:10px;border-left:1px solid rgba(255,255,255,.3)}.zpt-ld{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,0,30,.9);display:none;flex-direction:column;justify-content:center;align-items:center;color:#fff;font-family:sans-serif;z-index:99998}';
  doc.head.appendChild(style);
  const loaderEl = doc.createElement('div'); loaderEl.className = 'zpt-ld'; loaderEl.textContent = 'Loading…'; doc.body.appendChild(loaderEl);
  const loader = t => { loaderEl.style.display = t ? 'flex' : 'none'; if (t) loaderEl.textContent = t; };
  const pill = doc.createElement('div'); pill.className = 'zpt-pill'; pill.textContent = '% Off ↓';
  pill.onclick = () => { mode = mode === 'disc' ? 'price' : 'disc'; applySort(); };
  doc.body.appendChild(pill);
  let dock = null, fab = null;
  function closeAll() { if (dock) dock.remove(); if (fab) fab.remove(); pill.remove(); loaderEl.remove(); window.__ZPT_SORTER__ = null; }
  if (isMobile) {
    fab = doc.createElement('div'); fab.className = 'zpt-fab';
    fab.innerHTML = '<span>⚡ Sort</span><span class="zpt-x2">×</span>';
    fab.onclick = e => { if (e.target.className === 'zpt-x2') closeAll(); else runManual(null); };
    doc.body.appendChild(fab);
    pill.style.bottom = '180px';
  } else {
    dock = doc.createElement('div'); dock.className = 'zpt-dock';
    const x = doc.createElement('div'); x.className = 'zpt-h zpt-x'; x.textContent = '✕'; x.onclick = closeAll; dock.appendChild(x);
    const mn = doc.createElement('div'); mn.className = 'zpt-h zpt-m'; mn.textContent = '−'; mn.onclick = () => { dock.classList.toggle('min'); mn.textContent = dock.classList.contains('min') ? '+' : '−'; }; dock.appendChild(mn);
    const man = doc.createElement('button'); man.className = 'zpt-btn man'; man.textContent = '⚡ Sort Page'; man.onclick = () => runManual(man); dock.appendChild(man);
    const list = doc.createElement('div'); list.className = 'zpt-list';
    CATEGORIES.forEach(c => { const b = doc.createElement('button'); b.className = 'zpt-btn'; b.textContent = c; b.onclick = () => runCategory(c, b); list.appendChild(b); });
    dock.appendChild(list); doc.body.appendChild(dock);
    pill.style.display = 'none'; pill.style.position = 'absolute'; pill.style.top = '8px'; pill.style.left = '8px'; pill.style.bottom = 'auto'; pill.style.right = 'auto';
    dock.appendChild(pill);
  }
  window.__ZPT_SORTER__ = { toggle: closeAll, sort: m => { mode = m || mode; applySort(); } };
})();
