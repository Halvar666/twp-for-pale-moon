# TWP for Pale Moon 1.0.0b3a6 — service resilience (unreleased test build)

## Scope

- Keep DeepL one-shot as experimental. On HTTP 429, respect Retry-After or back off at least 60 seconds; never retry HTTP 429 automatically.
- For DeepL 408, 500, 502, 503, 504, network error and request timeout only, allow **one delayed attempt (1250 ms)**; other errors, privacy failures and invalid response payloads never retry.
- Google: respect HTTP 429 Retry-After without retrying. Where no usable header exists, retain the previous two bounded short retries before a 60-second cooldown. Auth/token lookup is protected by the same cooldown.
- Bing: never retry 429, honor Retry-After or at least 60 seconds, flag 408/5xx/network and timeout errors as transient for page-level handling.
- The page translation scheduler stops after 429 for any provider; message displays approximate retry interval when known. It ignores late results and preserves completed translations for Restore.
- 8 localizations have identical 110 static and 109 dynamic keys. No options, permissions or external service endpoints are added.

## Checks

- `python3 tools/run-uxp-tests.py --filter tools/` — 30/30 passed.
- `python3 tools/run-uxp-tests.py --filter uxp/tests/` — 27/27 passed.
- New mock tests: `uxp/tests/test-b3a6-service-backoff.js` and `uxp/tests/test-b3a6-page-limit.js`.
- `python3 tools/build-uxp.py` — XPI integrity, version, exact extension ID and both application target IDs.

## Manual smoke tests still required

1. Install over 1.0.0b3a5 in Pale Moon 35 without resetting settings. Verify Preferences and Czech/English UI.
2. Verify standard Google and Bing page/selection translation, original restore, favorites, dictionary and backup. Nothing in these flows is intentionally changed.
3. Test DeepL if available. An occasional 503 should allow one delayed retry; 429 must stop and display the approximate cooldown. No automatic service switching is permitted.
4. Test same update and toolbar placement in Basilisk 52.9.x if available. New Moon remains unsupported.

No live translation endpoint or actual browser was invoked by the automated tests.
