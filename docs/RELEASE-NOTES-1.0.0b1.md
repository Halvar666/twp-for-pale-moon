# TWP for Pale Moon 1.0.0b1 — First public beta

The first beta of an **unofficial native UXP port** of TWP — Translate Web Pages for Pale Moon.

### [Added]
- Full-page and selected-text translation through Google and Bing; optional DeepL (experimental).
- Native popup, context menus and configurable shortcuts; automatic site/language rules.
- Optional disk-backed translation cache and privacy-enhanced requests.
- Page progress notices selectable in Preferences (off by default).

### [Fixed]
- Stability hardening of the translation scheduler, error handling, cancellation and retry.
- Compatibility of toolbar icon display with classic and custom Pale Moon themes.
- Version, About and UXP-specific descriptions; updated packaging and regression fixtures.

### [Notes]
- 37/37 automated regression suites passed. The maintainer reports this beta functional in Pale Moon 35.
- Google/Bing/DeepL rely on unofficial endpoints that may change or rate-limit access, especially DeepL.
- External providers receive submitted text and your network IP; privacy-enhanced requests are not anonymity.
- Pale Moon 33–35 compatibility is declared; active testing focuses on Pale Moon 35.
- Upgrading from a33 preserves the extension identifier and settings.
- This is **not an official release of upstream TWP**. Source and attribution are available in this repository under MPL 2.0.
