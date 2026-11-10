# TWP for Pale Moon 1.0.0b3 — Third Public Beta

This update adds settings backup, native UI localization and new translation controls, along with improved handling of temporary service errors.

### [Added]
- JSON export/import of settings, site rules and keyboard shortcuts. API keys are exported only when explicitly selected; the translation cache is excluded.
- Native UI localization in **8 languages**: English, Czech, German, French, Spanish, Polish, Slovak and Italian.
- Up to **3 favorite target languages** for quick selection in the translation popup.
- Optional **custom dictionary** for preserving terms or defining replacements (`source => replacement`).

### [Improved]
- Better HTTP 429 / `Retry-After` handling for translation providers; bounded retries for transient DeepL errors, without automatically switching services.
- Reproducible XPI packaging and expanded regression checks.

### [Fixed]
- Prevent potential vertical stretching of the translation-service selector in Preferences; older unsupported browser forks are not guaranteed to work.
- Remove redundant localization-script loading.

### [Compatibility]
- **Pale Moon 33–35** (primary target); **Basilisk 52.9.x** (basic compatibility).
- New Moon, historical Firefox and other forks are **not supported**.
- Updating from earlier betas preserves existing settings and the add-on ID.

**Notes:** DeepL remains experimental, and translation services use unofficial endpoints. Dictionary matching is case-sensitive and cannot span HTML text nodes; adjacent sentence fluency may be affected. New translations may need proofreading. **58/58 offline automated regression tests passed**; live service and browser testing remains important.

This is an independent UXP port of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web), licensed under **MPL 2.0**.
