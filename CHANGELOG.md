# Changelog

## 1.1.4 — Unreleased

- Recognize Noon's custom dirham symbol in AED price elements, including order history.
- Use the approved Midnight Tokyo icon at all extension sizes.

- Add first-use currency confirmation with a searchable list and a suggestion based on Chrome's explicit language region.
- Wait for confirmation before converting on fresh installs; preserve saved preferences and the historical PHP default for upgrades.
- Keep setup inside the popup instead of opening Settings automatically after installation.
- Include the Amazon deal-price fix from the v1.1.3 test build.

## 1.1.3 — Unreleased

### Fixed
- Convert Amazon deal-card amounts with “Deal Price,” “List Price” and “Typical” accessibility labels.
- Preserve those labels for assistive technology and restore original prices when conversion is paused.

### Documentation
- Add the Chrome Web Store installation link and distinguish the published version from the next test build.
- Update reporting instructions to reflect anonymous submission from the popup.

### Validation
- Conversion regression tests passed on Google Chrome 113 and 155, including dynamic price updates, restoration and conversion stability.
- Manual verification on Amazon's live deals page is pending.

## 1.1.2
- Fix repeated Amazon price conversion by excluding converted prices from source-currency detection and restarting only when the effective currency changes
- Preserve conversion during repeated stock/rating metadata updates; keep real currency changes working
- Convert Amazon price-to-pay widgets with blank hidden labels, with original spans restored when paused
- Keep private problem reports inside the toolbar popup, with readable sizing and concise privacy/confirmation states
- Add private Sheet reporting and daily JSON email digests; use readable Philippine-time inbox dates
- Refuse ZIP overwrites; new review packages use unique filenames

## 1.1.0
- Finalized for store submission after owner-confirmed Chrome pilot sign-off on 20 October 2026; removed the candidate label and added the public support contact
- Raised the unverified Chrome 105 floor to runtime-tested Chrome 113.0.5672.63; all 67 tests pass on official minimum and Stable Chrome builds, and CI now maintains that Chrome-only matrix
- Redesigned popup and Settings with a restrained Neo Tokyo palette, readable controls, clear rate freshness and keyboard focus
- Added local JSON bug reports with preview, copy/download and a user-submitted GitHub issue flow; hostnames and price examples are optional, with no automatic uploads
- Added bounded local error codes, privacy pages, support documentation and a GitHub issue template
- Fixed subdomain toggles affecting sibling sites, overlapping setting writes and malformed saved preferences
- Fixed partial currency/model matches, ambiguous `Ft` product dimensions and half-converted shared-label ranges
- Country storefront evidence now beats stray currency-looking product text; explicit currency menus and product metadata retain priority
- Split-price assembly no longer crosses separate semantic text blocks; editable fields and editor-contained Amazon prices are protected
- Mutation scans avoid overlapping pending subtrees; reports use canonical shapes rather than scraped product prose
- Provider freshness reflects provider timestamps; fallback seeding cannot overwrite a newly downloaded rate table
- Expanded worker, parser, DOM, packaged-extension, UI, accessibility and privacy tests; pinned dependencies and test-gated release packaging

## 1.0.8
- Fixed prices with spaces, Indian lakh grouping, three-decimal currencies and high-precision amounts; small conversions keep useful digits instead of rounding to zero
- Fixed split superscript cents (Walmart / Liverpool), `29€99`, Turkish `TL`, Kenyan `KSh`, and leftover alphabetic currency labels such as `RM`
- Star ratings and model numbers such as `RM-9595` are no longer converted as prices
- Fixed source-currency detection for Falabella country stores, Mercado Libre Colombia and HKTVmall; late product data can correct an earlier detection
- Currency-menu changes pause conversion while the shop updates, then re-detect the selected source currency
- Amazon-style prices now update and restore the latest shop price; exchange-rate refreshes keep displayed prices and hover rates consistent
- Longer paragraphs are scanned, and bare split decimals require a price context
- Added automated parser, browser DOM and unpacked-extension regression tests

## 1.0.7
- The version number now shows at the bottom of the popup and in the Settings page footer

## 1.0.6
- Free items (`฿0`, `0.00`, free shipping) no longer light up the amber count on the icon or appear in "Copy details" as missed prices (seen on shopee.co.th)

## 1.0.5
- Prices with a plain space as thousands separator drawn in pieces (`2 299` `,00` `zł`) now convert instead of being skipped (found while checking allegro.pl layouts)
- "Copy details" report now also shows the exchange rate used (live or built-in), so a wrong-looking number can be checked against it. Converted prices are still never included.

## 1.0.4
- Fixed wrong site currency on Mercado Libre and similar shops: product text like "Ryzen 5 AMD" no longer counts as a price in Armenian dram, which made `$` prices convert as US dollars (far too high)
- On pages full of `$` prices, the address now decides which dollar (.com.ar = peso, .com.mx = peso, .cl = peso...) over a stray currency code in the text
- AMD, NAD, NIO and CRC are no longer read as currency codes

## 1.0.3
- The word "rand" (`1283 rand`) now identifies South African rand, so `R 1,283` converts on sites like takealot.com that have no .za address

## 1.0.2
- Split prices now convert even when hidden screen-reader text sits next to them (bol.com cards)
- Bare prices after a price word convert: `Adviesprijs 34,95`, `vanaf 43,47`, `from`, `ab`, `UVP` and similar

## 1.0.1
- Prices drawn inside web components (shadow DOM) are now found and converted, including nested and late-loading ones
- Prices written with a trailing dash (`1 299,-`, `25.–`) convert on Norwegian, Danish and Swiss sites
- Bare prices split into pieces (`13` `,` `55`) are joined and converted (bol.com style)
- Crossed-out old prices (`<s>34,99</s>`) convert

## 1.0.0
- First release
