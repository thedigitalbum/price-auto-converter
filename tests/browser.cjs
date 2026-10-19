// Playwright's Chromium protocol adapter controls Google Chrome, our only target.
const fs = require("node:fs");
const path = require("node:path");
const saved = path.join(__dirname, "../test-results/chrome-stable.json");
const config = process.env.CHROME_EXECUTABLE
  ? {
      executable: process.env.CHROME_EXECUTABLE,
      version: process.env.CHROME_EXPECTED_VERSION,
    }
  : fs.existsSync(saved)
    ? JSON.parse(fs.readFileSync(saved, "utf8"))
    : null;
if (!config)
  throw new Error(
    "Install official Chrome for Testing first: python3 scripts/install_test_chrome.py stable",
  );
function browserOptions() {
  return { executablePath: config.executable, args: ["--headless=new"] };
}
async function verifyBrowser(browserOrContext) {
  const browser =
    typeof browserOrContext.version === "function"
      ? browserOrContext
      : browserOrContext.browser();
  const version = browser.version();
  if (config.version && version !== config.version)
    throw new Error("Unexpected Chrome version: " + version);
  const minimum = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.SOURCE_DIR || path.join(__dirname, ".."),
        "manifest.json",
      ),
      "utf8",
    ),
  )
    .minimum_chrome_version.split(".")
    .map(Number);
  const actual = version.split(".").map(Number);
  let comparison = 0;
  for (let i = 0; i < 4 && !comparison; i++)
    comparison = (actual[i] || 0) - (minimum[i] || 0);
  if (comparison < 0)
    throw new Error("Test Chrome is below the declared minimum: " + version);
  console.log(
    "Browser under test: " +
      version +
      " (Google Chrome; manifest minimum verified)",
  );
}
module.exports = { browserOptions, verifyBrowser };
