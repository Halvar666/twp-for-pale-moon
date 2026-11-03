# TWP for Pale Moon 1.0.0b2 — Second public beta

This beta update improves text formatting, provides more convenient page translation controls, and adds **basic Basilisk compatibility** while keeping **Pale Moon** as the primary supported browser.

### [Fixed]
- Preserve line breaks, blank lines and indentation when translating selected text, including long multi-paragraph selections.
- Better handling of multiline, preformatted natural-language text such as Japanese **Update History** sections on GitHub README pages; keep the original layout and allow restoring the original text.
- Fix Google translation failures caused by the multiline-fragment integration (Bing was unaffected).
- Improve source-language auto-detection for manually translated Japanese/Korean/Chinese content on pages whose interface declares another language.

### [Added]
- Page context submenu: **Translate page**, **Always translate example.com**, **Forget translation for example.com**, and **Restore original page**.
- Basic **Basilisk 52.9.x** installation support and Australis toolbar-placement handling. The maintainer has verified that the button retains its position after restarting Basilisk.

### [Improved]
- Reduce the interval between experimental DeepL requests from **1250 ms to 750 ms** while retaining single-request concurrency. Rate limits or HTTP 429 responses are still possible.
- Keep selected-text translation and the existing Google/Bing provider logic intact.

### [Compatibility and notes]
- **Pale Moon 33.0–35.*** remains the primary declared target, with actual testing focused on Pale Moon 35.
- **Basilisk 52.9.0–52.9.*** is a **basic compatibility target**, not a promise of complete feature parity. Basilisk uses the historical Firefox application ID; **Firefox is not supported**.
- Updating from **1.0.0b1** or the **b2a1–b2a5** test builds retains the extension ID and saved preferences.
- **45/45 automated regression suites passed**. Manual browser testing remains important.
- **DeepL is experimental**, and all providers use unofficial service endpoints which may change or become unavailable.
- Submitted text and connection IP are visible to the chosen translation provider; privacy-enhanced requests do not make the user anonymous.
- This is an independent UXP port of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web), not an official release from the original developer. Source attribution and the **Mozilla Public License 2.0** are preserved.
