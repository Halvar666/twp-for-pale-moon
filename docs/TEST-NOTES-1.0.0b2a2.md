# TWP for Pale Moon 1.0.0b2a2 — TEST ONLY

## Report

On 3 November 2026, the maintainer observed that Google stopped while translating the GitHub `amate/Proxydomo` page in b2a1 with the message `missing[i].nodes is undefined` at group 369/389 after 325 nodes. Bing completed translation and preserved the layout.

## Root cause

The b2a1 special handling of preformatted multiline text (`pageController.js`, `translateWithLayout`) expanded a PRE text node into synthetic pieces containing `originals` but missing `nodes`. Google `translatePieces()` reads `missing[i].nodes.length`, while Bing does not require it. Thus b2a1 passed its permissive mocked-provider tests but failed with the real Google adapter.

## Fix

Attach the original PRE text node to each synthetic fragment's `nodes` metadata (`{nodes:[piece.nodes[0]], originals:[text]}`). The provider uses `nodes.length` only to decode the expected number of segments; the actual DOM update happens after all line fragments have been translated, preserving whitespace and restoring original text. No Google endpoint change or Bing adapter change was needed.

## Validation

- The new `uxp/tests/test-b2a2-google-pre.js` integration test uses the real Google provider with mocked HTTP responses. It failed on the b2a1 code with an undefined `.length` error, and passed after the fix.
- Run `python3 tools/run-uxp-tests.py` to verify all regression suites.
- Run `python3 tools/build-uxp.py` for an installable XPI.
- In-browser retest needed: Google translation of `https://github.com/amate/Proxydomo` (especially Update History) and Bing/selected-text translation.

This is not a published GitHub release. Basilisk is not officially supported.
