# 1.1.0 release candidate — readiness review

Reviewed 19 October 2026. Baseline: main commit `23cf3ba` (1.0.8). Recommendation: **ready for an unpacked pilot; do not submit to the Web Store yet.** No store submission, production merge or release tag was performed.

## Completed phases

1. Audited conversion boundaries, split-price assembly, source precedence, editable fields, lifecycle cleanup, mutation batching, storage quotas, background fetches, permissions and release packaging. Fixed defects and added regression coverage.
2. Implemented free local reports with schema/version, preview, copy/download, optional context, bounded fixed-code history and a user-submitted public GitHub issue flow. Added a support template and privacy documentation.
3. Rebuilt popup and Settings with a restrained Neo Tokyo navy/violet/cyan palette, readable typography, clear controls, native keyboard interaction, visible focus, stronger control borders and narrow-window layouts. Support and privacy screens use the same styling. No remote fonts or runtime dependencies.
4. Ran the automated suite, actual unpacked-extension tests, automated accessibility checks and a public live-site follow-up. Prepared a separate release branch, candidate ZIP and submission draft.

## Evidence and practical limits

**67 automated tests passed** in isolated Chromium 151 on Windows, with no skips. Parser tests include 578 grouped-number variants, high precision, malformed inputs, three-decimal currencies, Indian grouping and adversarial punctuation. DOM tests cover raised cents, split labels, source changes, country stores, ratings/models, editable fields, long paragraphs, open shadow DOM, dynamic updates, 200 inserted prices, fee changes and original-price restoration. Worker tests cover provider validation, freshness, offline fallback, cache retention, concurrency, throttling and sender checks. Storage tests cover quota failures, serialization and corrupt settings.

Actual unpacked-extension tests exercise the service worker, content scripts, storage, source-price updates and restoration. UI tests use real extension pages; the popup's active-tab query is directed to a controlled fixture because it is opened as a test tab rather than a toolbar bubble. They verify persistence, rules, unsupported-page controls, report opt-ins, JSON file contents, a stubbed clipboard/GitHub action, stale-rate status and labels. Automated axe-core WCAG 2/2.1/2.2 tagged checks found no violations on popup, Settings, Report and Privacy. Layout checks cover 375px settings/report windows and a 384px popup. These do not replace human screen-reader, visual or toolbar-bubble testing.

Reports were checked for accidental URL, page-prose, arbitrary-class and form-data leakage. Default exports exclude hostnames, examples and site lists. Invalid saved event objects and private extra fields are dropped. The GitHub action was tested without submitting an issue. Clipboard writing was stubbed in automation; native clipboard behavior needs the manual pilot. JSON download contents were read back and parsed successfully.

Pinned development dependencies installed successfully; npm reported zero known vulnerabilities at the audit time. This is a dependency database result, not a guarantee of security. No executable third-party packages are included in the extension ZIP. Existing permissions remain storage, alarms, content-script page access and two rate-provider hosts. Network access is data-only; there is no automatic report endpoint, embedded secret, analytics SDK or remote executable code. Built-in rates were refreshed from the primary provider and keep their provider date.

## Live-site follow-up

Sixteen priority sites from the earlier 78-site survey were attempted using the candidate in a fresh isolated Chromium profile, targeting PHP with a 0% buffer. No account, purchase, CAPTCHA solution or personal Chrome-profile change was involved. This is a short homepage/sample sweep, not full product/cart/checkout certification. Counts are converted text carriers at capture time, not unique products. Pages and rates can change between runs.

| Site                                                                   | Result                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walmart                                                                | 58 conversions observed; USD source. Split-cent regression is also covered by deterministic fixtures.                                                                                                                   |
| Lazada Malaysia                                                        | 49 conversions observed. Initial sweep exposed incorrect bare-source voting; fixed country precedence and revisited: MYR source, RM examples consumed without residual labels.                                          |
| Amazon Canada                                                          | Conversions observed. Initial sweep exposed `Ft` dimensions interpreted as HUF; fixed with independent HUF-context requirement. Revisit showed CAD source and 77 conversions. Unit coverage proves feet stay unchanged. |
| CoinMarketCap                                                          | 159 conversions observed; original fragments retain full precision in regression fixtures. Live prices move, so this is not a historical rate-accuracy certification.                                                   |
| Apple US                                                               | 460 conversions observed, including long terms containing $1200, $930 and $350.                                                                                                                                         |
| Figma pricing                                                          | Nine conversions observed; ambiguous $ falls back to USD without independent page source evidence.                                                                                                                      |
| GOG                                                                    | 253 conversions observed; USD currency-menu source.                                                                                                                                                                     |
| Steam                                                                  | Native PHP identified; zero conversions, as expected for sampled PHP prices.                                                                                                                                            |
| Falabella Chile                                                        | Loaded, CLP country context detected, no priced sample captured. Coverage remains unverified.                                                                                                                           |
| HKTVmall                                                               | Loaded, HKD country context detected, no priced sample captured. Coverage remains unverified.                                                                                                                           |
| Digikala                                                               | Loaded, zero conversions. Persian numerals and toman/IRR remain unsupported; this is not a successful conversion test.                                                                                                  |
| Liverpool, Mercado Libre Colombia, Jumia Nigeria, Hepsiburada, Allegro | HTTP 403/access denial or challenge. No compatibility pass claimed. Relevant prior failures are covered by fixtures, which cannot substitute for live validation.                                                       |

The earlier all-78-site report concerns the user's 1.0.7 installation. It is historical context, not evidence that 1.1.0 passed 78 sites. Browser-policy-blocked sites were not bypassed. No extension-origin page errors were observed in accessible live captures; that observation does not prove absence of all failures.

## Defects corrected in this candidate

- Partial matches in model identifiers and malformed amounts; `Ft` feet/HUF ambiguity; half-converted shared-label ranges now remain unchanged.
- Country storefronts losing to stray currency-looking product text. Explicit product data and active currency menus retain priority.
- Split assembly crossing separate semantic text blocks or page-root containers.
- Editable elements and Amazon-style prices within editors being processed.
- A child-site enable action removing an inherited parent pause and affecting siblings.
- Overlapping storage writes, malformed settings and report-event objects, and stale popup rate-status labels.
- Report generation failure leaving sharing controls enabled; product/HTML/prose in old diagnostics replaced by bounded structured context.
- Overlapping pending mutation subtrees; fallback seeding race; provider freshness being confused with request time.
- Release packaging omitting new runtime screens/files. The release workflow now tests before building.

## Remaining release gates

1. Install the extracted candidate into actual Chrome, with other copies disabled. Test the real toolbar popup, native clipboard, downloaded report, persistence after browser restart and a rate refresh. The candidate has been loaded in isolated official Chrome for Testing as well as Chromium; it has not replaced the user's installed copy.
2. Pilot public product pages and dynamic variants on the owner's frequently used shops. Include a shop currency switch, a source override, a pause/re-enable, lazy loading and disable/reload restoration. Revisit the denied sites only when normal access becomes available. Report issues using the new flow.
3. Perform a human keyboard/screen-reader review, including whether a shop's accessible price labels remain understandable. Check 200% text/browser zoom and a laptop-height toolbar popup. The Chrome-version gate is resolved: the declared minimum is now 113.0.5672.63, with all 67 tests passing on official Chrome for Testing 113.0.5672.63 and 155.0.8059.84. Scope is desktop Chrome only; see CHROME_COMPATIBILITY.md.
4. Confirm the documented unsupported formats are acceptable for initial scope. Do not advertise every site/currency/layout. Digikala support requires a separate numeral/toman feature with independent source and scale tests; guessing could introduce a 10× error.
5. After the pilot passes, approve/merge the release PR, publish the privacy policy URL, finish actual store screenshots/contact/distribution and data-use declarations, remove the candidate label, rebuild/retest the final ZIP and submit deliberately. Google makes the acceptance decision.

Run `npm ci`, install official Chrome for Testing using `python3 scripts/install_test_chrome.py stable`, then `npm test`. Point `SOURCE_DIR` at the extracted candidate to validate shipped runtime files. See [store draft](STORE_LISTING.md), [support workflow](BUG_REPORTS.md) and [privacy policy](../PRIVACY.md).
