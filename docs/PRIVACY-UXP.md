# TWP for Pale Moon — privacy notes (UXP port)

This document describes the **native Pale Moon UXP/XUL port**, not the unmodified upstream WebExtension. It is a technical overview, not a guarantee of anonymity.

## Online translation

Text submitted for translation goes directly over HTTPS to the chosen provider (Google, Bing or optional experimental DeepL). Services necessarily see the **submitted text**, the connection IP address (or VPN/proxy exit IP), plus standard transport metadata. A VPN is needed to replace the public client IP; it does not hide submitted text from the provider.

**Privacy-enhanced translation requests** is enabled by default via `extensions.twpuxp.privacyEnhancedRequests`. The port uses an XHR adapter that requests anonymous UXP/XPCOM HTTP channels (`LOAD_ANONYMOUS`) to suppress automatic cookies and stored authorization credentials, and clears the HTTP Referer; if these protections cannot be set it does not send the protected request. The setting can be disabled for compatibility, removing this explicit protection. This does not suppress all possible HTTP headers or make the request anonymous. The DeepL provider adds the fixed protocol header `Authorization: None`, which is not a user's credential.

The network mode was manually tested in Pale Moon 35 using an isolated mitmproxy profile: captured Google/Bing requests had no Cookie, Authorization, Referer or Origin headers; DeepL had no Cookie, Referer or Origin and did have its static `Authorization: None`. These observations confirm the examined requests only, not that every network path or redirection can never transmit identifying data. A control test with pre-existing provider cookies was not performed.

## Local storage

Translation preferences and optional automatic translation rules are saved in the Pale Moon profile. Translations are cached in memory while the browser runs. The **persistent SQLite cache** is optional and disabled by default; if enabled, it saves original and translated text in the profile to avoid repeated requests, except in private windows. Turning it off stops new use of persistent cache but does **not** delete existing entries; use **Clear stored translations** in Preferences to delete them.

## Limitations

- Avoid translating passwords, confidential forms or other private content using external translation services.
- The port does not claim end-to-end confidentiality from the translation provider, IP anonymity, or control over provider retention policies.
- Provider endpoints are unofficial, so behavior and accessibility can change.
- The upstream `PRIVACY` file in the complete source archive is part of the original project's unchanged source and may describe features not implemented here.
