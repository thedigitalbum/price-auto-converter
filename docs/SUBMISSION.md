# Chrome Web Store submission — 1.1.2

Prepared 20 October 2026 after the owner approved the Chrome pilot and final Amazon stability fixes. Developer registration and payment are complete. Publisher: Harry Rama. Support: thedigitalbum@gmail.com. The dashboard has not been filled or submitted by this work: Chrome blocks browser automation of the extensions gallery.

## Package

Upload only the extension ZIP named price-auto-converter-v1.1.2-webstore-<timestamp>.zip. Do not upload the larger submission-kit ZIP. Manifest version: 1.1.2. Minimum Chrome: 113.0.5672.63. The upload package is byte-identical to the extracted artifact that passed all 93 tests on official Chrome 113 and 155. The ZIP contains 23 runtime files, with manifest.json at its root; tests and the Google collector source are excluded.

## Create the listing

Open https://chrome.google.com/webstore/devconsole and choose New item. Upload the extension ZIP, then use the submission kit's dashboard-fields.txt, listing-description.txt and permission-justifications.txt. Language: English. Category: Shopping if available. Listing name: Price Auto Converter. Default distribution: free, public, all available regions. Review any region-specific account declarations yourself.

Use the icon128.png, promo-440x280.png and current 1280x800 screenshots from the kit. The conversion screenshot depicts an explicitly labelled demonstration storefront, processed by the real packaged extension using bundled rates. The report and toolbar popup screenshots show real extension UI at its 384px width, centered on a screenshot canvas. No report is sent when capturing assets.

Privacy policy: https://github.com/thedigitalbum/price-auto-converter/blob/main/PRIVACY.md
Support: https://github.com/thedigitalbum/price-auto-converter/issues

## Privacy practices

Single purpose: convert supported webpage prices into the user's selected currency, with original-price explanations and per-site controls. All executable code is bundled. Remote code: No. Rates and report responses are JSON data, not scripts executed in Chrome.

Disclose Website content, Web history/current-page website information, and Financial/payment information conservatively under Google's current definitions. The extension processes price text and currency evidence locally, uses the current hostname for source inference/site controls, and can encounter monetary amounts. It does not collect a chronological browsing-history database or payment credentials. A user-submitted report transmits the public hostname, relevant settings, rates/counts, masked structure and fixed error codes to a private Google inbox. Exact prices, full URLs, prose, form entries, cookies and credentials are excluded from reports.

Preferences/site rules may sync through Chrome. Rate providers receive normal connection metadata, including IP addresses. Google also processes report transport metadata; the collector does not add IP addresses to Sheet rows. Reports are stored in a private Sheet, emailed as a daily JSON digest and retained for up to 90 days. Email copies must be deleted within 90 days by the maintainer. Offline reports wait locally for up to seven days, maximum five. There are no ads, analytics, data sales, unsolicited crash uploads or credit/lending purposes.

The first data-use checkboxes disclose types handled. The separate policy-certification checkboxes are the publisher's attestations: read and accept them personally only if they accurately describe ongoing practices. Do not certify blanket no-data handling or claim reports never leave the browser. See the current dashboard wording before choosing categories; the kit documents facts rather than making legal attestations for the owner.

## Reviewer test instructions

No login or credentials are required. Install, choose PHP, and open a public page with USD prices. Converted amounts are estimates; hover to see the original and rate. Toggle conversion off and on to verify restoration. Amazon's split main price, variants and normal dynamic updates are supported by regression fixtures. Currency overrides, site pause, styles and an optional fee buffer are available. Report a problem stays inside the toolbar popup; review the disclosure and press Send to submit redacted diagnostics privately. A receipt confirms storage; offline submissions queue and retry. Live rates may fall back to clearly labelled bundled estimates. Iranian toman/IRR, Persian numerals, images/canvas, closed shadow roots, cross-origin frames and some layouts remain unsupported. If a retailer blocks access, choose another public priced page; do not bypass challenges.

## Submit with deferred publishing

Save each dashboard section. Resolve any missing-information errors. Select Submit for review, turn off automatic publishing, then confirm submission. Review any agreement or certification before accepting it. Save the item ID, dashboard URL and resulting review status. After approval, deferred publishing leaves a separate manual release action; Google currently allows up to 30 days to publish a staged item before it reverts to draft.

The latest local tests and owner pilot do not constitute Google approval. No listing or review submission is claimed until the dashboard confirms it.

References checked 20 October 2026: https://developer.chrome.com/docs/webstore/publish , https://developer.chrome.com/docs/webstore/cws-dashboard-privacy , https://developer.chrome.com/docs/webstore/images
