/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Experimental UXP port-adapter based on the request/response protocol in
 * FilipePS/Traduzir-paginas-web, src/background/translationService.js,
 * release v10.2.1.0 (not a verbatim upstream copy).
 * This is NOT an official Google Translate API and may cease to function.
 */
var TWPGoogleProvider = (function () {
  "use strict";
  var endpoint = "https://translate-pa.googleapis.com/v1/translateHtml";
  var authScriptURL = "https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main";
  var keyCache = "";
  var keyCacheTime = 0;
  var keyWaiters = null; // Only one token lookup for all parallel batches.
  var cooldownUntil = 0;
  function retryAfterMs(value) {
    if (!value) return 0;
    var raw = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(raw))
      return Math.max(0, Math.round(Number(raw) * 1000));
    var date = Date.parse(raw);
    return isNaN(date) ? 0 : Math.max(0, date - Date.now());
  }
  function rateLimited(wait) {
    var err = new Error("Google endpoint HTTP 429 (rate limit)");
    err.httpStatus = 429;
    err.rateLimited = true;
    err.retryable = false;
    err.retryAfterMs = Math.max(0, wait);
    return err;
  }

  function xhr(method, url, headers, body, timeoutMs, cb) {
    var remaining = cooldownUntil - Date.now();
    if (remaining > 0) { cb(rateLimited(remaining)); return; }
    var req;
    try { req = TWPUXPPrivacyXHR.create(method, url); }
    catch (privacyError) { cb(privacyError); return; }
    req.timeout = timeoutMs || 20000;
    req.setRequestHeader("Accept", "*/*");
    if (headers) {
      for (var k in headers) if (Object.prototype.hasOwnProperty.call(headers, k)) {
        req.setRequestHeader(k, headers[k]);
      }
    }
    var completed = false;
    function finish(err, text) { if (!completed) { completed = true; cb(err, text); } }
    req.onload = function () {
      if (req.status < 200 || req.status >= 300) {
        var serverError = new Error("Google endpoint HTTP " + req.status);
        serverError.httpStatus = req.status;
        serverError.retryable = (req.status === 408 || req.status === 429 ||
          req.status === 500 || req.status === 502 ||
          req.status === 503 || req.status === 504);
        if (req.status === 429) {
          var after = 0;
          try { after = retryAfterMs(req.getResponseHeader("Retry-After")); }
          catch (ignore) { /* Header not exposed by this build. */ }
          if (after > 0) {
            cooldownUntil = Math.max(cooldownUntil, Date.now() + after);
            finish(rateLimited(cooldownUntil - Date.now()));
            return;
          }
          serverError.rateLimited = true;
        }
        finish(serverError);
      } else { finish(null, req.responseText); }
    };
    req.onerror = function () {
      var error = new Error("Google endpoint network error (HTTP 0)");
      error.retryable = true;
      finish(error);
    };
    req.ontimeout = function () {
      var error = new Error("Google endpoint request timed out");
      error.retryable = true;
      finish(error);
    };
    req.onabort = function () { finish(new Error("Google endpoint request aborted")); };
    try { req.send(body || null); }
    catch (e) { finish(e); }
  }

  // Temporary upstream errors are retried only twice, with bounded backoff.
  // No global automatic switch to another service: translating page contents
  // through Bing/Microsoft requires an explicit choice by the user.
  function translationRequest(payload, apiKey, timeout, callback) {
    var attempt = 0;
    var delays = [650, 1600];
    function send() {
      xhr("POST", endpoint,
        {"Content-Type":"application/json+protobuf", "X-goog-api-key":apiKey},
        payload, timeout, function(error, responseText) {
          if (error && error.retryable && attempt < delays.length) {
            var wait = delays[attempt++];
            setTimeout(send, wait);
            return;
          }
          if (error) {
            error.attempts = attempt + 1;
            // No Retry-After means the old two fast retries remain available,
            // but a final HTTP 429 still initiates a conservative cooldown.
            if (error.httpStatus === 429 && !error.retryAfterMs) {
              cooldownUntil = Math.max(cooldownUntil, Date.now() + 60000);
              error = rateLimited(cooldownUntil - Date.now());
              error.attempts = attempt + 1;
            }
          }
          callback(error, responseText);
        });
    }
    send();
  }

  function getKey(timeout, configured, cb) {
    if (configured) { cb(null, configured); return; }
    if (keyCache && Date.now() - keyCacheTime < 15 * 60 * 1000) {
      cb(null, keyCache); return;
    }
    if (keyWaiters) { keyWaiters.push(cb); return; }
    keyWaiters = [cb];
    xhr("GET", authScriptURL, null, null, timeout, function(err, data) {
      var token = null;
      if (!err) {
        var match = data && data.match(/['"]x-goog-api-key['"]\s*:\s*['"](\w{39})['"]/i);
        if (match) token = match[1];
        else err = new Error("Google authorization token not found; upstream endpoint may have changed");
      }
      if (token) { keyCache = token; keyCacheTime = Date.now(); }
      var callbacks = keyWaiters || [];
      keyWaiters = null;
      callbacks.forEach(function(fn) { fn(err, token); });
    });
  }

  function escapeHTML(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }
  function decodeHTML(escaped, doc) {
    var box = doc.createElement("textarea");
    box.innerHTML = escaped;
    return box.value;
  }
  // TWP upstream Google provider encapsulates fragments inside <pre> and
  // often separates translated sentences using <b> / <i> pairs.
  function extractTranslation(value, doc) {
    var html = String(value || "");
    html = html.replace(/^\s*<pre[^>]*>/i, "").replace(/<\/pre>\s*$/i, "");
    var pieces = [];
    var re = /<b>([\s\S]*?)(?=<i>|<\/b>|$)/gi;
    var m;
    while ((m = re.exec(html))) pieces.push(m[1]);
    if (pieces.length) html = pieces.join(" ");
    else html = html.replace(/<i(?:\s[^>]*)?>[\s\S]*?<\/i>/gi, "");
    html = html.replace(/<[^>]+>/g, "");
    return decodeHTML(html, doc).trim();
  }

  function translateMany(texts, source, target, doc, configuredKey, timeout, callback) {
    getKey(timeout, configuredKey, function (err, apiKey) {
      if (err) { callback(err); return; }
      var items = texts.map(function (txt) { return "<pre>" + escapeHTML(txt) + "</pre>"; });
      var payload = JSON.stringify([[items, source, target], "te"]);
      translationRequest(payload, apiKey, timeout, function (error, responseText) {
          if (error) { callback(error); return; }
          try {
            var result = JSON.parse(responseText);
            if (!result || !result[0] || result[0].length !== items.length) {
              throw new Error("Unexpected TWP/Google response format or item count");
            }
            var outputs = result[0].map(function (html) { return extractTranslation(html, doc); });
            if (outputs.some(function (x) { return !x; })) throw new Error("Empty translated fragment returned");
            callback(null, outputs);
          } catch (parseError) { callback(parseError); }
        });
    });
  }

  // TWP page-mode: collect contiguous inline nodes inside indexed <a> tags
  // so Google can use surrounding text context and we can restore the order.
  // Adapted from upstream translationService.js googleService cbTransformRequest/
  // cbTransformResponse in v10.2.1.0, with ES-compatible regexp traversal.
  function encodePiece(piece) {
    var array = piece.originals.map(function (s) { return escapeHTML(s); });
    if (array.length > 1) {
      array = array.map(function (s, i) { return '<a i=' + i + '>' + s + '</a>'; });
    }
    return '<pre>' + array.join('') + '</pre>';
  }
  function parsePiece(html, count, doc) {
    var result = String(html || '');
    result = result.replace(/<\/pre>/ig, '');
    var firstTagEnd = result.indexOf('>');
    if (/^\s*<pre\b/i.test(result) && firstTagEnd !== -1) result = result.slice(firstTagEnd + 1);
    var sentences = [], cursor = 0;
    while (true) {
      var begin = result.indexOf('<b>', cursor);
      if (begin === -1) break;
      var end = result.indexOf('<i>', begin);
      if (end === -1) { sentences.push(result.slice(begin + 3)); break; }
      sentences.push(result.slice(begin + 3, end));
      cursor = end + 3;
    }
    if (sentences.length) result = sentences.join(' ');
    result = result.replace(/<\/b>/g, '');

    // Original TWP mapping of <a i=n> segments (Google may reorder them).
    var pieces = [], lastEndPos = 0, match;
    var regex = /(<a\s+i\s*=\s*["']?([0-9]+)["']?\s*>)([^<>]*)/gi;
    while ((match = regex.exec(result))) {
      var outside = result.slice(lastEndPos, match.index).replace(/<\/a>/ig, '');
      pieces.push({index: parseInt(match[2], 10), text: outside + match[3]});
      lastEndPos = regex.lastIndex;
    }
    if (pieces.length) {
      var tail = result.slice(lastEndPos).replace(/<\/a>/ig, '');
      pieces[pieces.length - 1].text += tail;
    }
    if (count === 1 && !pieces.length) {
      result = result.replace(/<i(?:\s[^>]*)?>[\s\S]*?<\/i>/ig, '').replace(/<[^>]+>/g,'');
      return [decodeHTML(result, doc).trim()];
    }
    if (!pieces.length) throw new Error('Google indexed markup missing');
    var translated = new Array(count);
    for (var i = 0; i < pieces.length; i++) {
      var idx = pieces[i].index;
      if (idx < 0 || idx >= count) continue;
      var txt = decodeHTML(pieces[i].text.replace(/<[^>]+>/g, ''), doc);
      translated[idx] = translated[idx] ? translated[idx] + ' ' + txt : txt;
    }
    for (var j = 0; j < count; j++) {
      if (!translated[j] || !translated[j].trim())
        throw new Error('Google omitted text segment ' + j + '/' + count);
    }
    return translated;
  }

  // Ephemeral duplicate-request cache adapted from upstream TWP's cache layer.
  var pieceCache = new Map();
  function translatePieces(pieces, source, target, doc, configuredKey, timeout, cb) {
    if (!pieces.length) { cb(null, []); return; }
    var keys = pieces.map(function (p) { return JSON.stringify([source,target,p.originals]); });
    if (keys.every(function (k) { return pieceCache.has(k); })) {
      cb(null, keys.map(function (k) { return pieceCache.get(k).slice(); })); return;
    }
    var missing = [], missingIndexes = [], output = new Array(pieces.length);
    keys.forEach(function (key, index) {
      if (pieceCache.has(key)) output[index] = pieceCache.get(key).slice();
      else { missing.push(pieces[index]); missingIndexes.push(index); }
    });
    getKey(timeout, configuredKey, function (err, apiKey) {
      if (err) { cb(err); return; }
      var items = missing.map(encodePiece);
      var payload = JSON.stringify([[items,source,target], 'te']);
      translationRequest(payload, apiKey, timeout, function(error, responseText) {
        if (error) { cb(error); return; }
        try {
          var raw = JSON.parse(responseText);
          if (!raw || !raw[0] || raw[0].length !== items.length)
            throw new Error('Unexpected response count from Google');
          raw[0].forEach(function(html, i) {
            var translated = parsePiece(html, missing[i].nodes.length, doc);
            var index = missingIndexes[i];
            output[index] = translated;
            // Bound the in-memory cache. No text is persisted to disk.
            if (pieceCache.size >= 500) pieceCache.clear();
            pieceCache.set(keys[index], translated.slice());
          });
          cb(null, output);
        } catch(parseError) { cb(parseError); }
      });
    });
  }

  return { translateMany: translateMany, translatePieces: translatePieces, endpoint: endpoint };
})();
