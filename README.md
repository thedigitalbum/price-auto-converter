# Price Auto Converter – Convert Prices to Your Currency (Chrome extension)

Converts prices on any web page into the currency you pick.

Every converted price is marked so nobody mistakes it for the shop's own price: a small `≈`
before it, a faint tint and a dotted underline (all painted on top of the text, so page layout
doesn't move). Hover a converted price to see the original price, the rate used, and a note that
the browser extension converted it. Choose a lighter style in Settings.

## Install (no Web Store needed)
1. Unzip this folder somewhere permanent.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `price-converter` folder.
4. The settings page opens. Pick your currency. Done.

Pin the extension (puzzle-piece menu). Clicking its icon opens a small panel with:
- **Convert prices on this site** switch: turns the extension off/on for the current site only
  (the icon shows an `OFF` badge on disabled sites).
- A status line, and a **Settings** button.
- **Missed a price? Copy details**: copies a short description of prices that weren't converted (element
  names and short price text only, no web address or personal text) so it can be fixed.

**Smarter symbols.** `$`, `¥`, `kr`, `Rs` and `R` mean different currencies in different countries,
so Price Auto Converter reads the site first (product data, its address such as `.com.au`, its
language) and only then falls back to USD / JPY / INR. `kr` and `R` are only converted when the
page makes clear which krona or rand it is. Pick fixed meanings in Settings if you prefer.

**Card fee buffer.** Add 0 to +5% (0.5% steps) on top of the rate, in the panel or in Settings.

**Offline.** Approximate rates ship inside the extension and are used until live rates download
(and whenever the network is down). The panel says when rates are built-in or more than 2 days old.

**Reading the icon badge** (per tab; hover the icon for a one-line explanation):
- **Amber `!`**: exchange rates haven't loaded yet (open the panel or Settings and press Refresh).
- **Amber number** (e.g. `3`): that many prices on the page show no currency and it couldn't be
  worked out. Open the panel and pick the currency.
- **Grey `OFF`**: switched off on this site.
- **No badge**: nothing needed, all good.

**Sites with their own currency converter** (for example a Shopify store with a currency menu) are
detected automatically, and prices are still converted to your currency with no clicks, whether or
not the site's menu offers it. To avoid clashing with the site's script, conversion starts about a
second after load, and if you use the site's own currency menu the extension steps aside for that
moment and converts again once the site has finished. If a site still misbehaves, switch the
extension off for it with the panel's site switch.

**Smarter symbols.** `$`, `¥`, `kr`, `Rs` and `R` mean different currencies in different countries,
so Price Auto Converter reads the site first (product data, its address such as `.com.au`, its
language) and only then falls back to USD / JPY / INR. `kr` and `R` are only converted when the
page makes clear which krona or rand it is. Pick fixed meanings in Settings if you prefer.

**Card fee buffer.** Add 0 to +5% (0.5% steps) on top of the rate, in the panel or in Settings.

**Offline.** Approximate rates ship inside the extension and are used until live rates download
(and whenever the network is down). The panel says when rates are built-in or more than 2 days old.

**Reading the icon badge** (per tab; hover the icon for a one-line explanation):
- **Amber `!`**: exchange rates haven't loaded yet (open the panel or Settings and press Refresh).
- **Amber number** (e.g. `3`): that many prices on the page show no currency and it couldn't be
  worked out. Open the panel and pick the currency.
- **Grey `OFF`**: switched off on this site.
- **No badge**: nothing needed, all good.

## Test it
- Open `test.html` in Chrome. For `file://` pages, first go to the extension's
  **Details** on `chrome://extensions` and turn on **Allow access to file URLs**.
  Or serve the folder: `python -m http.server 8000` then visit `localhost:8000/test.html`.
- Then try a real shop or news site.

## After you change code
`chrome://extensions` → click the reload arrow on the extension, then refresh the page.
Errors: **Details → Inspect views → service worker** (background), or DevTools console (page).

## Files
- `manifest.json` – extension config (Manifest V3)
- `background.js` – fetches/caches exchange rates every 6 hours
- `lib.js` – price detection, parsing, conversion, formatting
- `content.js` / `content.css` – converts text on pages, live updates, hover tooltip
- `options.html` / `options.js` – settings page
- `popup.html` / `popup.js` – toolbar icon panel (per-site switch, status)

© 2026 Harry Rama. Released under the MIT License (see `LICENSE`).

## For developers
- Console diagnostics are off. To turn them on, open the settings page, press F12 and run
  `chrome.storage.sync.set({ debug: true })`, then reload the tab you're testing.
- Chrome Web Store package: zip everything except `test.html` and `README.md`
  (`manifest.json` must be at the top level of the zip).

## Support
Free forever. If it saves you time, you can support it on Ko-fi: https://ko-fi.com/harryrama
