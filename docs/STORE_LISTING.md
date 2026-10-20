# Chrome Web Store listing copy

Prepared 20 October 2026 after owner-confirmed pilot sign-off. Not yet submitted. Publisher: Harry Rama. Public support email: thedigitalbum@gmail.com. Final dashboard steps are in SUBMISSION.md.

## Listing copy

Name: **Price Auto Converter**

Short description: Convert supported prices to your currency, with original-price hints, rate freshness and simple per-site controls.

Detailed description:

Browse supported shopping pages with prices shown in your preferred currency. Converted amounts are marked as estimates; hover one to see its original price and the rate used.

Choose your target currency from the popup. Pause a website, correct its source currency or add an optional card fee buffer. Settings offers lighter display cues, rounding and website rules. Live rates refresh periodically, and clearly labelled built-in estimates are available offline.

Price conversion happens in your browser. Report a problem prepares a redacted summary automatically. Press Send report to submit privately without an account or typing. The hostname, settings and masked structural diagnostics go through Google Apps Script to a private developer inbox. No exact prices, full URLs or page prose are included. Offline submissions retry for up to seven days. There are no analytics or unsolicited crash uploads.

Conversion is a display estimate, not a guaranteed checkout or bank rate. Images, canvas, closed shadow roots, cross-origin frames and some numeral systems or price layouts are unsupported. Iranian toman/IRR and Persian-digit prices are outside current support. Shared-label ranges such as $10–20 stay unchanged. Ambiguous symbols may require a source-currency correction. Pause a site if conversion interferes with it.

## Purpose and permission justifications

Single purpose: Convert supported webpage price text into a user-selected currency, with original-price explanations and controls for correcting or pausing that conversion.

| Manifest access                               | Justification                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                     | Save user preferences and website rules; cache exchange rates and bounded local operational error codes. Preferences/rules may use Chrome sync.                                                                                                                                  |
| `alarms`                                      | Refresh the exchange-rate cache every six hours and retry explicitly submitted offline reports.                                                                                                                                                                                                                                 |
| Content script `<all_urls>`                   | Find and replace supported price text automatically on websites the user visits, including new shops without a hard-coded allowlist. Processing stays local. Site controls let users pause or correct conversion. Browser restrictions and user-granted site access still apply. |
| `https://open.er-api.com/*`                   | Download USD-based JSON exchange-rate data from the primary provider.                                                                                                                                                                                                            |
| `https://cdn.jsdelivr.net/npm/@fawazahmed0/*` | Download fallback JSON currency data. No scripts are fetched or executed.                                                                                                                                                                                                        |

No `tabs`, `scripting`, `downloads`, `clipboardRead`, cookie, history, webRequest or remote-code permissions are requested. Existing `chrome.tabs` methods used to open/query an active tab do not require the sensitive `tabs` permission; page status supplies its own hostname. Sending diagnostics requires a user gesture; no clipboard access is needed.

Remote code declaration: **No remote code**. All executable JS/CSS is bundled. Rate-provider responses are parsed as data only. Development tools and tests are excluded from the ZIP.

## Privacy and support fields

Public policy URL: https://github.com/thedigitalbum/price-auto-converter/blob/main/PRIVACY.md

Support: https://github.com/thedigitalbum/price-auto-converter/issues

Verify this public main-branch URL loads before submission. An offline copy is also bundled.

Dashboard disclosures must match the current code and policy. Describe local webpage-price processing, Chrome-synced preferences/site rules, rate-provider network metadata, local fixed-code history, and user-submitted private diagnostics including hostname and redacted structural data. Do not state “never handles website content” or “never handles financial information”: conversion reads price text locally, and reports include the current public hostname and redacted structural diagnostics. No automatic collection of browsing history, credentials, cookies or payment information is implemented. Assess the dashboard's current category definitions against these facts before certifying; no dashboard answers or legal certifications were submitted by this work.

## Assets and final submission

Use authentic extension screenshots; do not promise universal conversion or compatibility with blocked sites. Produce store-sized listing assets from the approved build, confirm the maintainer's contact details and distribution settings, publish the privacy policy, and complete Google's current dashboard requirements. The supplied UI previews are review evidence, not finished store promotional assets.

Primary guidance reviewed 19 October 2026: [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [privacy dashboard fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [review process](https://developer.chrome.com/docs/webstore/review-process). Google requires accurate disclosures, narrow permissions, meaningful support and pre-submission testing; final acceptance is Google's decision.

## Reporting update — pending deployment

Version 1.1.1 adds host access to the configured script.google.com deployment and script.googleusercontent.com for the response redirect. These send only explicitly submitted diagnostics to the private developer inbox. The Google Sheet remains private; the receiver executes as the developer. Update dashboard disclosures for website hostname and diagnostics transmitted to Google and the developer. The old main-branch privacy policy must be replaced before release. Do not submit this update until the real anonymous receiver and daily digest pass live checks.
