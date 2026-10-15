# Changelog

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
