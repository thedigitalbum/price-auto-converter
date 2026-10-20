# Price Auto Converter privacy policy

Last updated: 20 October 2026. Maintainer: Harry Rama.

## Conversion and preferences

Price text and currency signals are processed locally to change displayed prices. Preferences and website rules use Chrome storage and may sync through Chrome. Cached rates and up to 40 fixed error codes with timestamps stay in local extension storage. Removing the extension removes its local data; browser sync is controlled by Chrome.

## Exchange rates

Rate requests go to open.er-api.com and jsDelivr's currency-api package without cookies or referrers. These providers receive normal network metadata, including IP addresses. Rate URLs contain neither the current website nor the chosen currency.

## Reports you choose to send

Opening Report a problem prepares a report locally. Nothing is uploaded until you press Send report. The report includes extension and Chrome versions, the current public hostname, conversion settings, rate information, counts, fixed error codes and redacted element structure. Digits in structural examples are masked. Exact prices, full URLs, page prose, arbitrary HTML/classes, form values, cookies, credentials and website-rule lists are excluded. Technical details and an optional local download are available before sending.

Pressing Send report transmits these diagnostics through Google Apps Script to a private Google Sheet controlled by Harry Rama. A daily JSON digest is emailed to thedigitalbum@gmail.com for diagnosing and fixing the extension. Users need no Google or GitHub account. Google processes these requests and ordinary network metadata under its own privacy policy: https://policies.google.com/privacy. The collector does not store IP addresses in the report Sheet. Reports are not public or used for advertising.

Offline submissions are kept locally for up to seven days and retried automatically, with at most five waiting reports. The interface distinguishes queued reports from confirmed receipt. Server reports are retained for up to 90 days; email copies are deleted within 90 days by the maintainer. A report reference can be supplied when requesting deletion; anonymous reporting does not collect a contact address or provide an automatic reply channel. Deletion of service backups is governed by Google. You can clear local error history from the report page.

## No advertising or analytics

There are no advertising trackers, analytics SDKs, data sales or automatic unsolicited crash uploads. Information is used only for price conversion and user-requested support. Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including Limited Use requirements.

## Contact

Harry Rama: [thedigitalbum@gmail.com](mailto:thedigitalbum@gmail.com). GitHub issues are optional public support, subject to GitHub's privacy policy; do not post sensitive information there.
