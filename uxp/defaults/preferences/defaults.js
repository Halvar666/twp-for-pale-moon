pref("extensions.twpuxp.toolbarInserted", false);
pref("extensions.twpuxp.from", "auto");
pref("extensions.twpuxp.to", "cs");
pref("extensions.twpuxp.batchSize", 8);
pref("extensions.twpuxp.maxNodes", 0);
pref("extensions.twpuxp.requestDelayMs", 0);
pref("extensions.twpuxp.timeoutMs", 20000);
pref("extensions.twpuxp.apiKey", "");
pref("extensions.twpuxp.useTwpParagraphEngine", true);
pref("extensions.twpuxp.concurrentRequests", 3);
pref("extensions.twpuxp.translateDynamicContent", true);
pref("extensions.twpuxp.translationService", "google");

// a11: opt-in automatic translation rules; exclusions take precedence.
pref("extensions.twpuxp.autoTranslateEnabled", false);
pref("extensions.twpuxp.autoTranslateSites", "");
pref("extensions.twpuxp.neverTranslateSites", "");
pref("extensions.twpuxp.autoTranslateLanguages", "");
// a24: language-based exclusions; only automatic translation is affected.
pref("extensions.twpuxp.neverTranslateLanguages", "");

// a15: attribute and same-origin frame translation.
pref("extensions.twpuxp.translatePageAttributes", true);
pref("extensions.twpuxp.translateIframes", true);

// a19: opt-in profile-local SQLite cache; contains translated webpage text.
pref("extensions.twpuxp.persistentCacheEnabled", false);

// a33: optional on-page progress notifications; errors always remain visible.
pref("extensions.twpuxp.showPageProgress", false);

// a20: optional translated-text hover preview of original (never persisted).
pref("extensions.twpuxp.showOriginalOnHover", false);

// a21: upstream-style keyboard shortcuts (can be disabled in Preferences).
pref("extensions.twpuxp.keyboardShortcutsEnabled", true);

// a23: user-configurable native XUL key bindings. Empty string disables one action.
pref("extensions.twpuxp.shortcutToggle", "control,alt|T");
pref("extensions.twpuxp.shortcutSelection", "control,alt|S");
pref("extensions.twpuxp.shortcutRestore", "alt,shift|VK_0");

// a26+: privacy-enhanced HTTPS translation requests; fails closed if UXP cannot enforce protection.
pref("extensions.twpuxp.privacyEnhancedRequests", true);
