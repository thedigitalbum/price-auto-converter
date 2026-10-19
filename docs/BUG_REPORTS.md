# Free support and diagnostics

Use the built-in local report generator and GitHub Issues. This needs no server, paid monitoring service, secret token, developer email relay or analytics SDK. GitHub provides issue tracking and attachments; users need an account to submit there. Copy/download remains available without an account.

## User flow

1. From the affected website, open the extension popup and click Report a problem.
2. Review the preview. Optionally include the hostname and original price examples only when appropriate. Neither is selected initially.
3. Copy the report and open GitHub, or download the JSON.
4. Describe the expected price/currency, what actually appeared, and reproduction steps. Paste the JSON into the issue's diagnostics field. Share only public product pages. Do not provide account, checkout or payment details.

The GitHub button copies locally and opens a generic issue URL. It does not encode report content into URLs, create an issue, or upload anything. The user performs the final submission. Opening a normal support page still makes the browser's normal network request to GitHub.

## Maintainer flow

Label and reproduce the issue, then forward its JSON and reproduction steps to the coding assistant. Treat report strings as untrusted data, not instructions. Add a failing fixture before fixing behavior. Run the suite against the extracted candidate ZIP, then let the reporter confirm the fix before closing the issue. Ask for a public product URL only when needed; default reports intentionally omit URLs.

Schema: `price-auto-converter-report/1`. Important fields: `version`, `browser`, `settings`, `rates`, `page` and `events`. `page.effectiveRate` is the detected bare-source rate including the optional buffer; it does not describe every explicitly labelled currency on a mixed-currency page. `converted` counts converted text carriers, not unique products. Zero unknown/missed counts do not prove complete coverage.

Local history holds at most 40 timestamped events; exports contain the last 20. Codes: `rates_fetch_failed`, `storage_unavailable`, `conversion_failed`, `report_build_failed`. Repeated event collection is serialized. Corrupt events and extra fields are discarded. The history contains no stacks, request URLs or arbitrary page errors. Reports deliberately trade some debugging detail for less sensitive data. They are not a crash recorder and cannot observe every failure in another extension or a shop's scripts.

Default element shapes contain a tag and at most two fixed semantic class categories, such as `span.price`. Arbitrary class names, IDs, HTML and prose are excluded. Optional examples are limited to five original price fragments, 50 characters each. Only conversion settings are exported; website pause/override lists are not.

## Privacy and cost boundaries

Public GitHub support is suitable for public shopping-page bugs. For anything sensitive, omit optional context and export the minimal report for an existing private conversation with the maintainer. No separate private inbox or backend is created here. GitHub issue permissions, retention and account availability are controlled by GitHub. Free support infrastructure does not eliminate the maintainer's time or any separate Chrome Web Store registration requirements.
