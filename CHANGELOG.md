# Changelog

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
