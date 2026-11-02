# TWP for Pale Moon

**Unofficial native UXP port** of [TWP — Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web) for the **Pale Moon** web browser.

**Version: 1.0.0b1 (beta)** · Tested in Pale Moon 35 · **MPL 2.0**

This is an independent community port, not affiliated with or endorsed by the upstream TWP author.

## Features

- In-page translation of complete web pages and selected text.
- Google Translate and Bing Translator; optional experimental DeepL.
- Automatic translation rules, source/target language selection, and restore-original functionality.
- Dynamic page content, accessible frames and translatable HTML attributes.
- Optional persistent cache (off by default); privacy-enhanced requests (on by default).
- Keyboard shortcuts and original-text-on-hover.
- Optional on-page progress notices (off by default); errors remain visible.

## Installation

The last user-tested beta is **1.0.0b1**. Its XPI was tested by the maintainer in Pale Moon 35. Updating over version 0.0.1a33 keeps the extension ID and existing preferences.

## Build and tests

```sh
python3 tools/build-uxp.py
python3 tools/run-uxp-tests.py
```

The XPI is built from the `uxp/` folder. The `src/` folder preserves the original WebExtension project under MPL 2.0. In the 1.0.0b1 source archive, all **37/37 automated test suites** pass.

## Privacy

Translation sends page text to the selected external provider. Privacy-enhanced requests cannot guarantee anonymity. Unofficial translation endpoints may change and DeepL may rate-limit long pages. Do not send sensitive page content to providers you do not trust.

## License, upstream and artwork

Original TWP: [FilipePS/Traduzir-paginas-web](https://github.com/FilipePS/Traduzir-paginas-web), © its respective authors and contributors, Mozilla Public License 2.0.

The blue port-specific translation icon was generated with ChatGPT, revised by the maintainer and finalized for this project. It is not copied from the original TWP icons.

The full original source, UXP port, credits, license notices, tests and artwork are retained in the prepared project source archive.

## Status

Beta 1.0.0b1 passed practical testing. Source import and GitHub release publication are being prepared.
