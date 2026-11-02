# TWP for Pale Moon 1.0.0b1 — First public beta

**TWP for Pale Moon** is an unofficial native UXP port of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web), adapted for the Pale Moon browser. It translates web pages in the current tab without redirecting to an external translated copy.

## Features

- **Full-page translation** using Google Translate or Bing Translator, with optional **experimental DeepL**.
- **Selected-text translation** in a separate dialog, with language selection, language swapping, and a Copy translation button.
- **Language controls:** source-language detection where possible, and configurable source/target languages.
- **Page handling:** dynamically loaded text, translatable HTML attributes, accessible same-origin frames, original-text-on-hover (optional), and Restore original.
- **Automatic translation rules** for chosen sites or page languages, with exclusions for sites and languages. Automatic translation is **off by default**.
- **Native Pale Moon interface:** toolbar button, translation popup, context menu, preferences, and configurable keyboard shortcuts.
- **Optional persistent SQLite cache** for translations, disabled by default.
- **Privacy-enhanced translation requests** enabled by default. Floating progress notices are optional and disabled by default; translation errors remain visible.

## Not yet ported from upstream TWP

- **PDF translation**, including the original TWP workflow using a separate PDF translation website.
- **Yandex** as an additional translation provider.
- **Text-to-speech** (listening to original or translated text).
- A user-configurable **LibreTranslate server** for selected-text translation.
- **Settings backup/import**, and the upstream option to choose the extension interface language.
- Translation of content inside **cross-origin iframes**.

These features are not available in this beta; the list is not a promise of a particular implementation schedule.

## Compatibility and notes

- Compatibility declared for **Pale Moon 33–35**; practical testing so far has focused on **Pale Moon 35**.
- **37/37 automated regression suites passed**, and the maintainer confirmed that 1.0.0b1 works in Pale Moon.
- The translation services use unofficial endpoints and can change, block, or rate-limit requests; **DeepL remains experimental**.
- Page text sent for translation and the connection IP address are visible to the chosen provider. Privacy-enhanced requests do **not** provide anonymity.
- This is an **independent, unofficial port**, not an official release of the original TWP project. Original author credits and source attribution are preserved under **MPL 2.0**.
