# Price Auto Converter privacy policy

Last updated: 19 October 2026. Maintainer: Harry Rama (`thedigitalbum` on GitHub).

## Price conversion

The extension reads supported price text and currency signals on pages where it runs and changes displayed text locally. It does not send page contents, URLs, browsing history, cookies, form values or passwords to the developer.

## Exchange-rate services

USD-based rate data is requested from `open.er-api.com` and the currency-api package on `cdn.jsdelivr.net`. These providers receive normal network information such as an IP address. Requests omit cookies and referrers. Rate URLs contain neither your current website nor your chosen currency. See the providers' own policies for their handling of network requests.

## Preferences and local error history

Currency choices, appearance preferences, fee buffers and website rules use Chrome storage. Chrome may sync these preferences and website rules when browser sync is enabled. Cached rates and a rolling list of up to 40 extension error codes use local extension storage. Each error entry contains a fixed code and timestamp, without page content or stack traces. Clear this history from the report page. Removing the extension removes its local data; browser sync is controlled by Chrome.

## Reports you choose to share

Reports are prepared locally and are not automatically uploaded or synced. They include the extension version, Chrome major version, relevant conversion settings, rate freshness, conversion factors, counts, canonical element shapes and recent fixed error codes. Hostnames and up to five original price examples are excluded unless you select them. Full URLs, page titles, page prose, forms, cookies and site-rule lists are excluded. Review the preview before exporting or sharing. Exported files and clipboard contents are under your control.

Opening GitHub does not transmit the JSON report. The extension copies it so you can paste and submit it yourself. GitHub issues are public and governed by [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Shared reports are used to diagnose and fix the extension. You may edit or delete content you posted, or ask the maintainer for help removing it. Avoid submitting personal purchase, account, payment or financial details.

## No advertising, analytics or data sales

The extension has no analytics, advertising trackers, automatic report uploads or data sales. Information is used only to provide and improve price conversion and user-requested support. The use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Contact

Contact the maintainer through [project issues](https://github.com/thedigitalbum/price-auto-converter/issues). Do not include sensitive information in a public issue. The installed extension also includes an offline privacy page linked from Settings and Report a problem.
