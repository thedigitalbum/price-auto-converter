# Chrome minimum-version validation

The supported product is a **desktop Google Chrome extension**. No other browser product is in the test matrix.

The manifest minimum was deliberately raised from the unverified `105` to **`113.0.5672.63`**. Chrome 105 is no longer claimed. Chrome 113 is an intentionally conservative, tested floor: Google's version-pinned Chrome for Testing downloads begin at milestone 113. This establishes an honest minimum without relying on third-party old-browser installers. It does not recommend downgrading a user's normal Chrome installation; users should keep Chrome updated.

## Runtime evidence

Full 67-test suite, Windows x64, 19 October 2026:

| Official Google Chrome for Testing build                                  | Result                         |
| ------------------------------------------------------------------------- | ------------------------------ |
| 113.0.5672.63 — declared minimum                                          | 67 passed; zero failed/skipped |
| 155.0.8059.84 — Stable returned by Google's official feed during this run | 67 passed; zero failed/skipped |

Each run verifies the actual browser version and loads the real unpacked extension into isolated Chrome profiles. Checks cover service-worker startup, bundled rates, storage, content scripts, price conversion and restoration, UI persistence, report JSON download, privacy boundaries and automated accessibility rules. Parser and worker unit tests run in Node alongside those browser tests. Chrome-version detection and the manifest floor are also asserted by the test helper.

The older binary was used only with controlled fixtures and blocked external DNS. Neither build replaced or downgraded the user's installed Chrome, and no personal profile was opened. Headless tests do not replace the remaining manual toolbar/clipboard/screen-reader pilot. Automated clipboard handling remains stubbed. This evidence does not claim every intervening Chrome version or every shopping site was individually tested.

Playwright names its Chrome protocol adapter `chromium`. That is the automation API used to control the explicit Google Chrome executable; it is not a claim that this extension supports another browser. Historical development tests using bundled Chromium remain supplementary evidence. The maintained CI matrix now downloads and tests **official Chrome minimum and Chrome Stable**, and release packaging waits for both jobs.

## Reproduce

Node.js 22+, Python 3.9+, Windows/Linux x64:

```sh
npm ci
# Linux only: install system libraries, without downloading a Chromium browser
npx playwright install-deps chromium
python3 scripts/install_test_chrome.py stable
npm test
```

The stable installer saves executable/version metadata in ignored `test-results/chrome-stable.json`; the test helper reads it automatically. For minimum-version testing, run `python3 scripts/install_test_chrome.py minimum`, then set `CHROME_EXECUTABLE` and `CHROME_EXPECTED_VERSION` from `test-results/chrome-minimum.json`. CI sets these automatically. `SOURCE_DIR` can point at the extracted ZIP. Downloaded browsers and development tools are excluded from the extension package.

The installer derives the exact minimum from the manifest, uses Google's metadata and HTTPS download host, checks archive paths, and preserves Linux executable permissions. Stable is resolved at test time so future compatibility regressions become visible. Test assertions verify the resolved version actually launched.

Sources: [Google's Chrome for Testing documentation](https://developer.chrome.com/docs/automation-and-testing/chrome-for-testing), [official availability and metadata](https://googlechromelabs.github.io/chrome-for-testing/), [Chrome 113 build metadata](https://googlechromelabs.github.io/chrome-for-testing/113.0.5672.63.json). This is a runtime-tested compatibility floor, not a guarantee of store acceptance.
