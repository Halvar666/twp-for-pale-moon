# Release checklist — TWP for Pale Moon 1.0.0b3

- [ ] Confirm install/update of `TWP-for-Pale-Moon-UXP-1.0.0b3.xpi` in Pale Moon 35 without resetting settings or toolbar placement.
- [ ] Verify Google/Bing whole-page and selection translation, multiline text, context menu, cancel and Restore.
- [ ] Verify JSON export/import, with API key opt-in, and exclusion of SQLite cache.
- [ ] Verify favorite targets and custom dictionary including Unicode and blank replacement.
- [ ] Verify at least Czech and English UI; optionally check longer German/French strings and basic Basilisk 52.9.x behavior.
- [ ] Run the complete regression suite and reproduce the XPI byte-for-byte. Confirm both application IDs and `1.0.0b3` metadata.
- [ ] Push all current source files to the repository before creating a release tag.
- [ ] Publish GitHub Release tag `1.0.0b3` as **Pre-release**, attach `TWP-for-Pale-Moon-UXP-1.0.0b3.xpi` and paste `docs/RELEASE-NOTES-1.0.0b3.md`.
- [ ] Preserve prior release tags and assets, and do not add unsupported New Moon or historical Firefox claims.
