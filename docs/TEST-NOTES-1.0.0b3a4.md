# TWP for Pale Moon 1.0.0b3a4 — Manual test notes

This is an unpublished development build, continuing directly from 1.0.0b3a3.

## Added
- **Preferences → Favorite target languages:** three optional slots; `Not selected` removes a slot; selecting the same language twice is rejected with an error before saving other changes.
- **Main popup:** only configured favorites supported by the currently selected provider appear. Clicking one changes the target-language selector and saves the existing `extensions.twpuxp.to` setting. Press **Translate page** afterwards to translate. It does not start translation automatically.
- Favorite language settings are provider-independent and retained if the provider is changed to one that does not support one of them.
- **Backup:** exports `favoriteTargetLanguages` without changing `formatVersion:1`. Import accepts older JSON backups that lack this field and preserves the currently configured favorites.
- Removed accidental duplicate `l10n.js` script references from overlay, options and selected-text dialog.

## Manual acceptance checks (Pale Moon 35)
1. Install over b3a3 and verify original default target language, rules, backup options and toolbar position survive.
2. With all three favorite slots blank, confirm no extra row appears in the main popup.
3. Set `cs`, `en`, and `ja` in Preferences, save, and reopen the popup. Choose English; confirm the target selector changes and `Translate page` uses English. Reopen and confirm the selected favorite is highlighted.
4. Set two slots to the same language; Preferences should show an error and should not save other changes.
5. Switch provider with a favorite not supported by the new provider (for example `ace` in Google vs Bing). Only supported favorites show; return to Google and confirm `ace` is still saved.
6. Export settings (without API key), change favorite languages and restore the JSON. Confirm all three return. Also import a backup made by b3a1 or b3a2 and verify existing favorites are retained.
7. Check English, Czech and longer localized labels in the 400px toolbar popup and Preferences. Test the selected-text dialog and page translation to exclude regressions.
8. Repeat essential UI checks in Basilisk 52.9.x if possible. New Moon 28 remains unsupported.

Automated result: 52/52 tests. Real browser rendering and translation-service network activity are not tested by the offline suite.
