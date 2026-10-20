> **1.1.1 reporting update:** private anonymous submission replaces GitHub reporting. On 20 October 2026 the deployed receiver passed anonymous receipt/deduplication/Sheet checks, an actual Chrome extension Send test and Gmail digest attachment verification. See docs/BUG_REPORTS.md. Earlier 1.1.0 release instructions below apply only to that release; Chrome Web Store submission remains pending.

# Chrome Web Store submission — 1.1.0

Prepared 20 October 2026. Owner-confirmed Chrome pilot passed. Publisher name: **Harry Rama**. Public support email: **thedigitalbum@gmail.com**. Developer account registration is still required. No store item or submission has been created.

## 1. Create the developer account yourself

Open [the developer dashboard](https://chrome.google.com/webstore/devconsole) with the Google account you want to own this extension. Complete Google's developer agreement, one-time registration payment and any account verification. Review the fee shown by Google before paying. This is separate from the free bug-reporting system; there is no paid telemetry/backend service.

Use an account you control and monitor. Google says the account email cannot simply be changed later; ownership transfer is a separate process. Complete any identity/business/trader declarations according to your circumstances. Do not share payment details, passwords or one-time codes in a support conversation.

## 2. Upload the extension ZIP

Choose **New item** and upload **price-auto-converter-v1.1.0-webstore.zip**. That ZIP has `manifest.json` at its root, version 1.1.0, minimum Chrome 113.0.5672.63 and no release-candidate label. The submission-kit ZIP contains instructions/assets and must NOT be uploaded as the extension package.

Record the item ID and dashboard URL after uploading. Keep the same item for future updates, and increment the manifest version for every subsequent package submitted as an update.

## 3. Store listing

Use STORE_LISTING.md for the description and permission justifications. Name: Price Auto Converter. Language: English. Suggested category: Shopping, if available in the current dashboard. Publisher: Harry Rama. Support email: thedigitalbum@gmail.com.

Public support: https://github.com/thedigitalbum/price-auto-converter/issues

Public privacy policy: https://github.com/thedigitalbum/price-auto-converter/blob/main/PRIVACY.md

Verify the privacy URL loads publicly before submitting. The bundled privacy page has the same practices/contact. No sign-in is needed to use the extension. Upload the supplied 128×128 icon, 440×280 promotional tile, and 1280×800 screenshots. The conversion screenshot uses a clearly labelled demonstration storefront with real extension conversion and bundled rates; it is not a third-party shop endorsement. Other screenshots are actual Settings and report pages.

## 4. Privacy practices

Single purpose and each permission justification are ready in STORE_LISTING.md. Remote code: **No**. All JS/CSS is bundled; providers supply JSON data only. No analytics or automatic report upload is implemented.

Do not choose a blanket “no user data handled” answer: local processing also needs disclosure. Use these conservative recommendations and verify them against the dashboard's exact definitions before certifying:

| Category                                                                                                                              | Recommended treatment and code facts                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website content                                                                                                                       | Disclose. Price text, currency metadata and element structure are processed locally for conversion; optional original-price fragments can be exported after selection.                                                                                                                                                                                                                                    |
| Web history / browsing activity                                                                                                       | Disclose current-page address/domain access for currency inference, popup state and site rules. This does not mean a chronological browsing-history database is kept. Hostnames are optional in exported reports; full URLs are excluded.                                                                                                                                                                 |
| Financial/payment information                                                                                                         | Conservatively disclose local monetary amounts: the extension runs broadly and can encounter personal financial amounts as well as public product prices. It does not intentionally collect payment credentials/card numbers, initiate transactions or send amounts automatically. Users are warned against sharing account/checkout/payment details.                                                     |
| Personally identifiable information, authentication information, health information, personal communications, location, user activity | Not intentionally collected as separate data categories by the extension. It has no form-value, cookie, history-database, credential, geolocation or activity-tracking API. Broad webpage text can contain sensitive context; conversion reads price fragments locally. If the current definitions encompass incidental page content, disclose that scope rather than certifying an inaccurate exclusion. |

Preferences/site rules may sync through Chrome. Rates and up to 40 timestamped fixed error codes use local storage. Network rate providers receive normal connection metadata such as IP address; requests omit cookies/referrers and contain no visited-site URL or selected target currency. Reports are previewed locally, hostname/examples default off, and only the user submits a public GitHub issue or shares an exported file. Contact email on this listing is the developer's own support address, not a field collected from extension users.

Read and certify Google's limited-use statements only if they accurately describe your ongoing practices. The implementation has no data sale, advertising/profile use or credit/lending purpose. A third-party review cannot certify how you will handle reports after users send them.

## 5. Distribution and reviewer instructions

Recommended first listing: free, public, all available regions, with publishing deferred until after review. These are recommendations; confirm your preferred audience in the dashboard. Unlisted means anyone with its URL can install it, rather than access being restricted to named testers. All visibility choices still require review.

Reviewer test instructions:

> No login or credentials are required. Install, choose PHP in the popup or Settings, and open a public page with USD prices. Converted amounts have estimate cues; hover to inspect the original/rate. Toggle conversion off to restore originals, then re-enable. Settings offers display styles, website rules, source-symbol choices and an optional fee buffer. Open Report a problem to preview/copy/download local JSON; no report is uploaded automatically. If live rates cannot be fetched, clearly labelled bundled estimates remain available. Supported formats and limitations are described in the listing. Persian-digit/toman, pence-only notation, images/canvas and some embedded layouts remain unsupported.

There is no checkout/payment service inside the extension. If a retailer blocks access, use another public priced page; do not solve or bypass challenges for the review.

## 6. Final review and submission

Confirm package version/hash, icon/screenshots, privacy/support URLs, owner contact, category, data declarations and distribution. At **Submit for review**, choose deferred/manual publishing if you want a separate release decision after acceptance. The developer completes agreements, payment, account attestations and final submission. Save the resulting status and item URL. A submitted/reviewed item is not necessarily published; verify the displayed state.

Google decides acceptance. No account registration or review approval is implied by this package. Once an item is public, retain support/privacy URLs and use the same item ID for updates.

Primary references checked 20 October 2026: [registration](https://developer.chrome.com/docs/webstore/register), [image requirements](https://developer.chrome.com/docs/webstore/images), [local-data disclosure FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution), [submission and deferred publishing](https://developer.chrome.com/docs/webstore/publish).
