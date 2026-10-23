# Price Auto Converter

Convert supported prices into a familiar currency while browsing. Amounts are estimates; hover a converted price to see its original and the rate used. The shop and your bank determine what you actually pay.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/price-auto-converter/jppiccnoanaeefjhmcdloolkdknhanej) · [Changelog](CHANGELOG.md) · [Privacy](PRIVACY.md) · [Report an issue](https://github.com/thedigitalbum/price-auto-converter/issues)

**Published:** v1.1.2. **Next update:** v1.1.4, available for manual testing; not yet submitted to the Chrome Web Store.

On a fresh install, open the extension and confirm your shopping currency. An explicit region in Chrome's language preferences supplies a suggestion; otherwise choose from the searchable list. Conversion starts after confirmation. Existing installations retain their saved currency, and no location permission or lookup is used.

## Features

- Convert supported prices automatically into your chosen currency.
- Check original amounts and exchange rates by hovering over a conversion.
- Pause individual websites or correct their source currency.
- Adjust rounding, display indicators and an optional card fee buffer.
- Send a redacted problem report directly from the popup.

## Install manually

1. Extract the release ZIP to a permanent folder.
2. Open `chrome://extensions`, enable Developer mode and choose **Load unpacked**.
3. Select the extracted folder containing `manifest.json`.
4. Pick your currency in Settings. If another copy is installed, disable it so only one copy converts prices.

For a new test build, extract it to a separate folder and load that folder. Disable older copies, including the Web Store installation, then refresh shopping tabs. A newly loaded folder may have a different extension ID and separate settings.

## Everyday controls

- Popup: choose a target currency, pause conversion on the current hostname, correct the source currency, add an optional card fee buffer, refresh rates or prepare a report.
- Settings: change global conversion, ambiguous `$`/`¥` behavior, estimate indicators, rounding and website rules.
- A website pause includes subdomains. More-specific exceptions let one subdomain stay active without enabling its siblings.
- Supported dynamic prices and open shadow roots are scanned as pages update. A shop's currency menu gets time to finish updating before conversion resumes.
- Provider timestamps and offline fallback rates are clearly identified. Live rate requests refresh every six hours; a failed refresh keeps existing estimates.

The badge shows `OFF` when paused, `!` when rates need attention, or a count of price candidates whose source is unknown. An empty badge does not certify that every price was found.

## Report a problem

Open the extension on the affected website, choose **Report a problem**, then **Send report**. No account or typed description is required. Reporting stays inside the popup; JSON download is also available.

Reports use schema `price-auto-converter-report/2` and include the current hostname, conversion settings, rates and redacted diagnostics. They exclude exact prices, full URLs, page text, passwords, cookies and form entries. Reports are sent only when requested; failed submissions may retry in the background. A private Google Sheet receives reports, and the maintainer receives a daily email digest. See [privacy](PRIVACY.md) and [reporting details](docs/BUG_REPORTS.md).

## Website access

Automatic conversion across shopping sites requires access to webpage content. Chrome therefore displays its broad website-access permission at installation. Price detection and conversion happen locally. Exchange-rate requests and explicitly submitted problem reports use the network; see the privacy policy for details.

## Limitations

- This is a display aid, not a checkout, tax, bank or guaranteed real-time rate calculator.
- Images, canvas-rendered prices, closed shadow roots and embedded cross-origin frames are unsupported.
- Persian and Arabic digit prices, Iranian toman/IRR handling, and pence-only notation such as `50p` are unsupported. Digikala therefore remains outside current conversion coverage.
- A shared-label range such as `$10–20` stays unchanged; repeated labels such as `$10–$20` are supported. `Ft` requires independent Hungarian currency context to avoid converting feet in product dimensions.
- `$` and `¥` can be ambiguous. Without evidence, they fall back to USD and JPY. The popup lets you correct the source for a site.
- Access denials, CAPTCHA, browser-internal pages and Web Store pages cannot be validated or converted normally. New site layouts can require fixes. Pause a site if conversion interferes with it.
- Hover originals are a pointer interaction. Automated accessibility checks cover the extension's own screens; they do not establish accessibility across every third-party shopping page.

## Chrome compatibility

Desktop Google Chrome **113.0.5672.63 or later**. The v1.1.2 release passed the complete test suite on official Chrome for Testing 113.0.5672.63 and 155.0.8059.84. The v1.1.3 Amazon fix passed conversion regression checks on both versions; manual verification on Amazon's live deals page is pending. See [Chrome version evidence](docs/CHROME_COMPATIBILITY.md).

## Development and validation

Node.js 22 or newer:

```sh
npm ci
npx playwright install-deps chromium
python3 scripts/install_test_chrome.py stable
npm test
```

The pinned development tools are not shipped in the extension. Tests cover parser boundaries and grouping, adversarial input, currency inference, separate price blocks, editable fields, split cents, dynamic updates/restoration, shadow DOM, storage, worker failures, report privacy/export, UI persistence, responsive layout and automated WCAG checks. Two tests load the actual unpacked extension into isolated Google Chrome profiles; no personal Chrome profile is modified. Fixtures use deterministic rates and no live network.

`SOURCE_DIR` can point the suite at an extracted release package. `UI_SCREENSHOTS` optionally saves popup, settings and report previews. CI tests pull requests and pushes; the tag release workflow runs tests before packaging. Live shopping pages require separate testing because fixtures cannot prove compatibility with every layout.

MIT license · Harry Rama. Rate providers: [ExchangeRate-API](https://www.exchangerate-api.com/) and [currency-api](https://github.com/fawazahmed0/exchange-api). [Support development](https://ko-fi.com/harryrama).
