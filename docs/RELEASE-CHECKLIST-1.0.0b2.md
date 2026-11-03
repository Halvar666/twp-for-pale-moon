# 1.0.0b2 release checklist

- [ ] Install b2 over 1.0.0b1 in Pale Moon 35; confirm original preferences and toolbar placement survive.
- [ ] Google and Bing: translate a normal page and the Japanese update history of `https://github.com/amate/Proxydomo`, then restore original text. Verify that lines/blank lines remain stable.
- [ ] Translate a long multiline selection from a plain-text page; verify copy and blank lines.
- [ ] Verify that the page context submenu updates per-site auto-translation preferences and can forget them without changing unrelated settings.
- [ ] Test DeepL on a medium-size page, and note any 429 responses; do not promise fixed service availability.
- [ ] Basilisk 52.9.x: verify installation without manifest changes, toolbar placement across restarts and basic page translation. Full feature support is not claimed.
- [ ] Run `python3 tools/run-uxp-tests.py`, then `python3 tools/build-uxp.py`, and confirm manifest version `1.0.0b2` and correct application IDs.
- [ ] Commit corresponding source before publishing GitHub release tag `1.0.0b2`; attach only XPI (GitHub generates source archives automatically).
