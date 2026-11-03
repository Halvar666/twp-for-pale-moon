# TWP for Pale Moon 1.0.0b2a1 — TEST ONLY

Based on public beta 1.0.0b1, without publishing a new release.

## What to test

- Selected text in a plain text file: internal and outer blank lines and line endings should be retained after translation.
- `https://github.com/amate/Proxydomo`: choose **Auto** as the source language; Japanese in the README history should no longer be forced from English even if GitHub declares an English UI language.
- README update-history `<pre>`: check the individual lines, blank lines, and Restore original.
- Long selections, manual language overrides, Google and Bing, plus optional DeepL.

## What is not fixed yet

- The quality of language-specific translations is controlled by the providers.
- PDF support and Basilisk toolbar positioning are outside this test build.
- Source-language inference uses obvious CJK script mismatch; it is not a full on-device language detector.

**Pale Moon 35 has not been manually tested with this exact b2a1 XPI yet.**
