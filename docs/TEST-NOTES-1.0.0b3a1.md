# Test plan: 1.0.0b3a1

1. In Preferences, save non-default languages, service, shortcuts, site rules, privacy mode, and toggles; export JSON without API key. Verify JSON contains only allowlisted settings and no SQLite data or toolbar placement.
2. Change saved values and import JSON: confirm the original settings are restored. Test restoring in a different Pale Moon profile.
3. Test an invalid JSON file, a wrong format version, a wrong preference type, an unknown key, an unsupported language, and duplicate shortcuts. Every one must be rejected with no partial changes.
4. With an API key stored, verify it is **absent** from a normal export and only present when the separate checkbox and confirmation are used. Importing a key requires a separate confirmation.
5. Confirm translated pages, popup, cache, selection translation, and toolbar placement still work after restore; cache contents must remain untouched.
6. Inspect the service list and help text in Preferences under Pale Moon 35 and Basilisk. The New Moon 28 layout change is best-effort and untested, with no compatibility guarantee.
7. Run `python3 tools/run-uxp-tests.py` and `python3 tools/build-uxp.py`.
