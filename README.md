> **1.1.2:** fixes Amazon conversion feedback loops and unnecessary metadata restarts. Includes the private reporting and popup improvements developed in 1.1.1. Chrome Web Store submission remains pending.

> **1.1.1 reporting update:** private anonymous submission replaces GitHub reporting. On 20 October 2026 the deployed receiver passed anonymous receipt/deduplication/Sheet checks, an actual Chrome extension Send test and Gmail digest attachment verification. See docs/BUG_REPORTS.md. Earlier 1.1.0 release instructions below apply only to that release; Chrome Web Store submission remains pending.

# Price Auto Converter

Convert supported prices into a familiar currency while browsing. Amounts are estimates; hover a converted price to see its original and the rate used. The shop and your bank determine what you actually pay.

**1.1.0 is prepared for Chrome Web Store submission.** The owner confirmed the Chrome pilot passed on 20 October 2026. It has not yet been submitted or published on the store. See [release readiness](docs/RELEASE_READINESS.md) for evidence and [submission instructions](docs/SUBMISSION.md) for the account and dashboard steps.

## Install manually

1. Extract the release ZIP to a permanent folder.
2. Open `chrome://extensions`, enable Developer mode and choose **Load unpacked**.
3. Select the extracted folder containing `manifest.json`.
4. Pick your currency in Settings. If another copy is installed, disable it so only one copy converts prices.

To update an existing unpacked installation, replace its files, click Reload on the extension card, then reload shopping tabs. A newly loaded folder may have a different extension ID and separate settings.

## Everyday controls

- Popup: choose a target currency, pause conversion on the current hostname, correct the source currency, add an optional card fee buffer, refresh rates or prepare a report.
- Settings: change global conversion, ambiguous `$`/`¥` behavior, estimate indicators, rounding and website rules.
- A website pause includes subdomains. More-specific exceptions let one subdomain stay active without enabling its siblings.
- Supported dynamic prices and open shadow roots are scanned as pages update. A shop's currency menu gets time to finish updating before conversion resumes.
- Provider timestamps and offline fallback rates are clearly identified. Live rate requests refresh every six hours; a failed refresh keeps existing estimates.

The badge shows `OFF` when paused, `!` when rates need attention, or a count of price candidates whose source is unknown. An empty badge does not certify that every price was found.

## Report a problem — free, with no automatic uploads

Click **Report a problem** in the website's popup. Review the JSON, optionally include the hostname and up to five original price examples, then **Copy report** or **Download JSON**. **Copy report & open GitHub** opens a public issue form; paste the JSON and describe the expected and actual behavior. You submit it yourself. GitHub requires an account; export does not.

No hosted logging service, API token, telemetry subscription or paid backend is needed. Reports have a stable schema (`price-auto-converter-report/1`) so the maintainer can forward them for debugging. The extension keeps only up to 40 timestamped, fixed error codes locally. It does not capture stack traces, form values, cookies or browsing history. Hostnames and price examples are excluded from exported reports unless selected. See [privacy](PRIVACY.md) and [support workflow](docs/BUG_REPORTS.md).

## Honest limits

- This is a display aid, not a checkout, tax, bank or guaranteed real-time rate calculator.
- Images, canvas-rendered prices, closed shadow roots and embedded cross-origin frames are unsupported.
- Persian and Arabic digit prices, Iranian toman/IRR handling, and pence-only notation such as `50p` are unsupported. Digikala therefore remains outside current conversion coverage.
- A shared-label range such as `$10–20` stays unchanged; repeated labels such as `$10–$20` are supported. `Ft` requires independent Hungarian currency context to avoid converting feet in product dimensions.
- `$` and `¥` can be ambiguous. Without evidence, they fall back to USD and JPY. The popup lets you correct the source for a site.
- Access denials, CAPTCHA, browser-internal pages and Web Store pages cannot be validated or converted normally. New site layouts can require fixes. Pause a site if conversion interferes with it.
- Hover originals are a pointer interaction. A full screen-reader review of third-party shopping pages remains a release pilot item; automated accessibility checks cover the extension's own screens.

## Chrome compatibility

Desktop Google Chrome only. The declared minimum is **113.0.5672.63**, deliberately raised from the unverified 105 claim. The complete suite passed on official Chrome for Testing 113.0.5672.63 and 155.0.8059.84 on Windows. The historical Chromium development runs remain supplementary evidence, not a separate browser support target. See [Chrome version evidence](docs/CHROME_COMPATIBILITY.md).

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
