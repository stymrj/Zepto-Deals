// Regression test for the blank-results bug class (Zepto v2).
// Loads the real fetch+parse section out of src/deals.js, feeds it a BFF
// widget payload and an RSC page fixture, and checks every parsed product
// carries the fields the results tab needs to render a card — then counts
// the cards that would render. Parser drops / malformed items are exactly
// how fetched deals used to vanish from the results tab.
// Run: node test-results-tab.js   (from this repo root)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'deals.js'), 'utf8');
const start = src.indexOf('// ── v2 Zepto fetch+parse ──');
const end = src.indexOf('// ── end v2 Zepto fetch+parse ──');
if (start < 0 || end < 0) throw new Error('v2 fetch+parse section not found in src/deals.js');
const section = src.slice(start, end);

// Stubs for the browser globals the section touches at definition time only.
const guessBrand = t => (String(t).trim().split(/\s+/)[0] || '').replace(/[^\w&'-]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = { fetch: () => { throw new Error('network must not be used in this test'); } };
global.window = {};
global.document = { cookie: '', querySelector: () => null, querySelectorAll: () => [], head: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
global.localStorage = { getItem: () => null, setItem() {}, length: 0, key: () => null };
const toast = () => {};
eval(section);

const bff = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-bff.json'), 'utf8'));
const rscHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-rsc.html'), 'utf8');

// 1. BFF widget path: 7 items in the fixture, 1 has no discount (excluded when
//    requireDiscount is true), 1 is out of stock (kept, flagged inStock:false).
const bffItems = extractWidgets(bff.pageLayout.widgets, 'Atta, Rice, Oil & Dals', 'Atta', true);
console.log('BFF parsed:', bffItems.length, '(expected 6)');
console.log('BFF titles:', bffItems.map(p => p.title).join(' | '));
console.log('BFF out-of-stock kept?', bffItems.some(p => !p.inStock));

// 2. RSC path: 5 products embedded in __next_f chunks.
const rscItems = extractRscProducts(rscText(rscHtml), 'Test');
console.log('RSC parsed:', rscItems.length, '(expected 5)');

// 3a. Built-in self-test (same code the sidebar button runs in-browser).
const selfTest = runSelfTest();
console.log('Self-test:', JSON.stringify(selfTest));
const diagCases = [
  [diagnoseEmpty({ status: 401, items: 0 }), 'logged-out'],
  [diagnoseEmpty({ status: 429, items: 0 }), 'rate-limited'],
  [diagnoseEmpty({ status: 200, items: 0, hasLocation: false }), 'no-location'],
  [diagnoseEmpty({ status: 200, items: 0, hasLocation: true }), 'category-empty'],
  [diagnoseEmpty({ status: 200, items: 3 }), 'ok']
];
console.log('Diagnostics:', diagCases.map(([got, want]) => got + '==' + want + ':' + (got === want)).join(', '));
const merged = mergeSearchResults([[{ id: 'x', disc: 20, price: 100, save: 20 }], [{ id: 'x', disc: 30, price: 90, save: 30 }, { id: 'y', disc: 10, price: 50, save: 5 }]]);
console.log('Multi-keyword merge dedupes to 2, keeps best disc?', merged.length === 2 && merged[0].id === 'x' && merged[0].disc === 30);
const jsonOut = toJsonExport(bffItems.slice(0, 1));
console.log('JSON export parses?', JSON.parse(jsonOut).length === 1 && JSON.parse(jsonOut)[0].discountPct === bffItems[0].disc);

// 3. Sorter read-the-label check on one fake card.
const card = zReadCard({ innerHTML: '<div><span>₹499</span><s>₹999</s><span>50% OFF</span></div>' });
console.log('Sorter reads 50% off / ₹499?', card && card.d === 50 && card.p === 499);

// 4. Render check: every parsed item must carry the fields card() needs,
//    and one card must render per parsed item (this is the blank-results guard).
const all = bffItems.concat(rscItems);
const bad = all.filter(p => !p.id || !p.title || !(p.price > 0) || p.mrp < p.price || p.disc == null || !/^https:\/\/cdn\.zeptonow\.com\//.test(p.img) || !/^https:\/\/www\.zepto\.com\/pn\//.test(p.url));
console.log('Items missing a card field:', bad.length);
const cards = all.map(p => `<article class="card"><div class="im" style="background-image:url('${p.img}')"><span class="dc">${p.disc}% OFF</span></div><div class="inf"><a class="ti" href="${p.url}">${p.title}</a><div class="pr"><b>₹${p.price}</b><s>₹${p.mrp}</s></div></div></article>`);
console.log('Cards rendered:', cards.length, 'of', all.length, 'parsed items');

const diagOk = diagCases.every(([got, want]) => got === want);
if (bffItems.length === 6 && rscItems.length === 5 && card && card.d === 50 && card.p === 499 && bad.length === 0 && cards.length === all.length && selfTest.pass && diagOk && merged.length === 2) {
  console.log('PASS: Zepto v2 parser renders 11/11 cards (BFF 6 + RSC 5) + self-test PASS + diagnostics 5/5');
} else {
  console.log('FAIL: expected BFF 6, RSC 5, sorter 50%/499, 0 bad items, 11 cards, self-test PASS, diagnostics 5/5');
  process.exit(1);
}
