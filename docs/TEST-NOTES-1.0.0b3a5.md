# TWP for Pale Moon 1.0.0b3a5 — Manual test notes

Unreleased development test build continuing directly from 1.0.0b3a4.

## Custom dictionary

In **Preferences → Custom dictionary**, enter one rule per line:

```text
Pale Moon =>
Toolbar => Panel nástrojů
Add-on => doplněk
```

- A blank right-hand side (`Pale Moon =>`) preserves the exact source term.
- A nonblank right-hand side replaces the source term literally without translating the replacement.
- Rules are **case-sensitive** and apply to **all** configured language directions. Latin terms match at word boundaries; CJK phrases can match without spaces. Longer overlapping terms take priority.
- Maximum 100 entries, 12000 characters total, 120-character source and 160-character replacement. Malformed/duplicate entries block saving before preferences are written.
- The dictionary applies to page and selection translation using Google, Bing and experimental DeepL. It works per text node: a protected phrase split across multiple HTML nodes is not a match. Translating text on either side separately can affect sentence fluency.
- Source expressions which match an entry are omitted from provider input, but other text on the page is still sent to the chosen service. No guarantee of privacy for a whole page.
- Preferences use ASCII-safe storage for non-ASCII replacements; exported JSON contains human-readable Unicode. Old backup imports without dictionary preserve the existing value. Translation cache and API key behavior are unchanged.
- The source text in the document is left untouched until the corresponding translated batch is complete; Restore Original recovers it normally.

## Manual acceptance checks

1. Upgrade from b3a4 in Pale Moon 35 and check that other settings, toolbar position, favorites and languages survive.
2. With empty dictionary, translate normal pages and a multiline selection. Behavior must match b3a4.
3. Set the example rules above. Translate an English page containing `Pale Moon Toolbar`. Confirm the protected name survives and `Toolbar` is replaced literally. Try `moonlight` to verify no partial-word substitution and `toolbar` to verify case sensitivity.
4. Select text with multiple lines, indentation and blank lines, including a protected term; verify copying and restored line layout.
5. Translate a GitHub README with a multiline `pre` block. Check that line endings/blank lines and dictionary matches in the same text node are preserved. Restore original page.
6. Test Google, Bing and DeepL with one short rule. Note that breaking sentences into fragments can produce less natural grammar and DeepL can still rate-limit.
7. Attempt to save a duplicate term, a line without `=>`, and more than 100 entries. Verify the dialog rejects invalid rules without changing saved settings.
8. Export JSON containing Czech replacements, alter settings and import it. Confirm the exact dictionary and UTF-8 text return. Import an old b3a4 backup and confirm that it does not clear the new dictionary.
9. Open Preferences in Czech, English, German, French, Spanish, Polish, Slovak and Italian (where available); verify the new text fits. Check Basilisk basic compatibility if possible.

Automated checks cover source structure and mocked provider calls, not visual UI rendering or live endpoint behavior. New Moon 28 remains unsupported.
