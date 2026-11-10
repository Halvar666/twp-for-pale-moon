/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. See https://mozilla.org/MPL/2.0/.
 * Direct UXP adapter originally adapted from FilipePS/TWP 10.2.1.0.
 * Experimental one-shot endpoint updated after the storefront path started
 * returning HTTP 404. This is NOT the official DeepL API.
 * Endpoint reference: DeepLX v1.2.0 migration to /v1/translate.
 * It can stop working or be rate-limited without notice.
 */
var TWPDeepLProvider = (function () {
  "use strict";
  var endpoint = "https://oneshot-free.www.deepl.com/v1/translate";
  var cache = new Map();
  // Rate limits on this unofficial service are undocumented. HTTP 429 is
  // never retried automatically. One bounded retry is allowed only for
  // transient transport/server faults (408, 500, 502, 503, 504). No proxy
  // rotation or automatic provider switching is used.
  var cooldownUntil = 0;
  function parseRetryAfter(value) {
    if (!value) return 0;
    var cleaned = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(cleaned))
      return Math.max(0, Math.round(parseFloat(cleaned) * 1000));
    var date = Date.parse(cleaned);
    return isNaN(date) ? 0 : Math.max(0, date - Date.now());
  }
  function rateLimitError(waitMs) {
    var err = new Error("DeepL HTTP 429 (rate limit; try Google/Bing or later)");
    err.httpStatus = 429;
    err.rateLimited = true;
    err.retryable = false;
    err.retryAfterMs = waitMs;
    return err;
  }
  function normalizeLanguage(lang, target) {
    var map = {
      "es-MX": "es-419", "no": "nb", "zh-CN": "zh-Hans",
      "zh-TW": "zh-Hant", "pt": "pt-BR"
    };
    if (target && lang === "en") return "en-US";
    return map[lang] || lang;
  }
  function makeRequest(texts, source, target, timeout, callback) {
    if (!texts.length) { callback(null, []); return; }
    var attempts = 0, finished = false;
    function finish(err, values) {
      if (!finished) { finished = true; callback(err, values); }
    }
    // A retry is intentionally limited to one, delayed request. No 429,
    // HTTP 4xx (other than 408), privacy failure or invalid response is retried.
    function attemptRequest() {
      if (finished) return;
      var remaining = cooldownUntil - Date.now();
      if (remaining > 0) { finish(rateLimitError(remaining)); return; }
      attempts++;
      var req, handled = false;
      function complete(err, values) {
        if (handled || finished) return;
        handled = true; // onload/onerror may both fire in unusual XHR builds.
        if (err && err.retryable && attempts === 1) {
          setTimeout(attemptRequest, 1250);
          return;
        }
        if (err) err.attempts = attempts;
        finish(err, values);
      }
      try {
        req = TWPUXPPrivacyXHR.create("POST", endpoint);
        req.timeout = timeout || 20000;
        req.setRequestHeader("Content-Type", "application/json");
        // Documented by community implementations of the anonymous one-shot API.
        req.setRequestHeader("Authorization", "None");
        req.onload = function () {
          if (req.status < 200 || req.status >= 300) {
            if (req.status === 429) {
              var after = 0;
              try { after = parseRetryAfter(req.getResponseHeader("Retry-After")); }
              catch (ignore) { /* Header not available. */ }
              var wait = Math.max(60000, after);
              cooldownUntil = Math.max(cooldownUntil, Date.now() + wait);
              complete(rateLimitError(cooldownUntil - Date.now()));
              return;
            }
            var error = new Error("DeepL one-shot HTTP " + req.status +
              (req.status === 404 ?
                "; endpoint unavailable; choose Google or Bing" :
                " (experimental, unofficial endpoint)"));
            error.httpStatus = req.status;
            error.retryable = [408, 500, 502, 503, 504].indexOf(req.status) !== -1;
            complete(error); return;
          }
          try {
            var data = JSON.parse(req.responseText);
            if (!data || !Array.isArray(data.translations) ||
                data.translations.length !== texts.length)
              throw new Error("Unexpected DeepL translation count; storefront protocol may have changed");
            var results = data.translations.map(function (entry) {
              if (!entry || typeof entry.text !== "string" || !entry.text.trim())
                throw new Error("Unexpected DeepL translation response structure");
              return entry.text;
            });
            complete(null, results);
          } catch (e) { complete(e); }
        };
        req.onerror = function () {
          var err = new Error("DeepL one-shot network error (HTTP 0)");
          err.retryable = true;
          complete(err);
        };
        req.ontimeout = function () {
          var err = new Error("DeepL one-shot request timed out");
          err.retryable = true;
          complete(err);
        };
        req.onabort = function () { complete(new Error("DeepL one-shot request aborted")); };
        var payload = {text: texts, target_lang: normalizeLanguage(target, true)};
        if (source && source !== "auto")
          payload.source_lang = normalizeLanguage(source, false);
        req.send(JSON.stringify(payload));
      } catch (e) { complete(e); }
    }
    attemptRequest();
  }
  // Unlike Google/Bing HTML marker formats, DeepL returns one string per
  // original text node. We flatten the pieces, then restore their boundaries
  // exactly. No guessing or slicing translated strings by character count.
  function translatePieces(pieces, source, target, doc, unusedKey, timeout, callback) {
    if (!pieces.length) {callback(null, []);return;}
    var output = new Array(pieces.length), missing = [], pending = [];
    pieces.forEach(function(piece, index) {
      var key = JSON.stringify([normalizeLanguage(source, false), normalizeLanguage(target, true), piece.originals]);
      if (cache.has(key)) output[index] = cache.get(key).slice();
      else {
        pending.push({index:index, key:key, count:piece.originals.length});
        piece.originals.forEach(function(text) {missing.push(String(text));});
      }
    });
    if (!pending.length) {callback(null, output);return;}
    makeRequest(missing, source, target, timeout, function(error, translated) {
      if (error) {callback(error);return;}
      try {
        var at = 0;
        pending.forEach(function(item) {
          var values = translated.slice(at, at + item.count);
          at += item.count;
          if (values.length !== item.count)
            throw new Error("Incomplete DeepL piece response");
          output[item.index] = values;
          if (cache.size >= 500) cache.clear();
          cache.set(item.key, values.slice());
        });
        if (at !== translated.length) throw new Error("Extra DeepL text segments");
        callback(null, output);
      } catch (e) { callback(e); }
    });
  }
  function translateMany(texts, source, target, doc, key, timeout, callback) {
    var pieces = texts.map(function(text) {return {originals:[text]};});
    translatePieces(pieces, source, target, doc, key, timeout, function(err, results) {
      callback(err, err ? null : results.map(function(group) {return group[0];}));
    });
  }
  return {translatePieces:translatePieces, translateMany:translateMany,
    normalizeLanguage:normalizeLanguage, endpoint:endpoint};
})();
