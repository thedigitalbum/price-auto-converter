# One-time developer setup — reporting is not live yet

1. Open script.google.com in the publisher Google account. Create a project. Paste the contents of ReportCore.gs followed by Code.gs into Code.gs. In Project Settings enable the manifest file and replace appsscript.json with the supplied manifest. Save.
2. Select setupCollector and Run. Review and authorize Google access yourself: spreadsheet access, send-only email, and managing this project's daily trigger. This creates the private inbox and one daily digest. Do not share the Sheet publicly. The execution log contains its private URL. Keep email copies no longer than 90 days.
3. Deploy → New deployment → Web app. Execute as yourself, access Anyone (anonymous). This exposes a bounded write-only receiver, not the Sheet. Review this new public access before approving. Copy the production /exec URL and provide it to the coding assistant. Never use /dev or a sign-in-only deployment.

The assistant then configures the endpoint, narrows extension permissions, verifies a credential-free test submission/receipt/row/deduplication, and rebuilds the installable ZIP. Run sendDailyDigest once to verify delivery to thedigitalbum@gmail.com; it sends real email. The free daily Google quotas still apply.

The endpoint URL is public, not a password. Never embed an OAuth token, API secret or mailbox credentials in the extension. A redeployment must preserve the URL or be followed by a new extension package. Tests use a mock transport and cannot prove your live deployment is working.
