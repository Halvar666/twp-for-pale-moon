# TWP for Pale Moon 1.0.0b3a3 — test notes

A development-only localization update based on tested b3a2.

Languages: en-US and cs-CZ (existing), plus de-DE, fr-FR, es-ES, pl-PL, sk-SK and it-IT (added).
Both short codes (`de`, `fr`, `es`, `pl`, `sk`, `it`) and regional codes are registered.
These translations are initial drafts and need human review, particularly the security/privacy wording.

## Suggested browser checks

1. Install 1.0.0b3a3 over b3a2; verify that saved settings, backups and toolbar position remain unchanged.
2. Switch Pale Moon's UI language and restart. Check the Preferences dialog, popup, selected-text dialog and context menus.
3. Check the longer privacy and backup descriptions for wrapping/scrolling. Test export/import confirmation and validation errors.
4. Verify the browser's English locale still works and Czech remains unchanged.
5. Google/Bing smoke test, manual Restore, DeepL optional; the provider code is unchanged.

This is not a public release. New Moon 28 remains unsupported; Basilisk 52.9.x has basic compatibility.
