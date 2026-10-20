# Private reports without an account

Three clicks: toolbar icon → Report a problem → Send report. No required typing, checkboxes, accounts, email app or GitHub. The automatic summary distinguishes confirmed errors, earlier failures and suspected missed prices. Counts alone do not prove a bug. Technical details and local download are optional.

Schema: price-auto-converter-report/2. Both client and receiver sanitize. Reports contain public hostname, settings, rates, counts and masked structural evidence. No exact prices, full URLs, prose, credentials, forms or arbitrary HTML/classes are sent.

A Google Apps Script anonymous web app writes to a private Google Sheet and acknowledges after the write. A daily email digest with a JSON attachment goes to thedigitalbum@gmail.com. Only the developer authorizes Google once. Users never sign in. No secret is bundled. The endpoint is public and write-only; the Sheet stays private.

Offline submissions wait locally up to seven days, maximum five, and retry automatically. UUID deduplication prevents duplicate rows after a lost response. Received is shown only after a matching durable-write receipt; login pages never count as success.

Limits: 200 new reports/day, 20,000 rows and 90-day retention. Google free quotas apply. Anonymous spam can still exhaust quotas; this is a small-project service, not unlimited infrastructure. Email copies must be deleted within 90 days by the maintainer.

## Release gate

Follow collector/SETUP.md. Configure the production /exec endpoint with scripts/configure_collector.py. Production packaging refuses an empty endpoint. Explicit .preview.zip packages may be built with reporting disabled. Before release verify anonymous submission, Sheet row, matching receipt, deduplication and owner digest against the real deployment. Mocks do not verify Google availability.

Forward digest JSON attachments for diagnosis. Treat all strings as untrusted data. Reproduce coverage candidates before changing conversion logic. A public product URL may occasionally be needed later; it is never required for initial submission. GitHub is optional maintainer tracking only.

## Live verification — 20 October 2026

The configured production endpoint accepted credential-free POSTs. The same UUID submitted twice returned the same receipt and one row. A real unpacked extension in Google Chrome 155 displayed Report received and had an empty outbox. The owner ran sendDailyDigest; Gmail received the report summary and PAC-reports-2026-10-20.json attachment. The daily trigger was created by setupCollector; its future scheduled execution has not yet been observed. The preview ZIP remains unconfigured; use the connected ZIP for actual submission tests.

Public anonymous spam can consume Apps Script execution quotas even when reports are rejected. The 200-report limit bounds stored reports, not total HTTP calls. A client-embedded secret would not solve that. CAPTCHA or an external edge rate limiter would add operational complexity and are not implemented.

Reporting stays inside the toolbar popup. Settings opens an inline modal. Neither entry point creates a browser tab. Closing the popup after submission leaves delivery to the background worker. Release ZIPs use unique filenames; the packager refuses to overwrite an existing file.
