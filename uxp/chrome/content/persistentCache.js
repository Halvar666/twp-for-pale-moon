/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * TWP UXP: opt-in, profile-local SQLite cache for completed translations.
 * Distinct keys for provider, source/target, request mode and original text.
 * The database contains text from visited pages: never persist by default.
 */
var TWPUXPCache = (function () {
  "use strict";
  var PREFIX = "extensions.twpuxp.";
  var FILE_NAME = "twpuxp-translations.sqlite";
  var MAX_ROWS = 2500;
  var PRUNE_INTERVAL = 100;
  var db = null, disabled = false, writes = 0, privateUtils = null;
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  function enabled() {
    try { return prefs.getBoolPref(PREFIX + "persistentCacheEnabled"); }
    catch (e) { return false; }
  }
  function profileFile() {
    var f = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    f.append(FILE_NAME);
    return f;
  }
  function storage() {
    if (db) return db;
    if (disabled) return null;
    try {
      var service = Components.classes["@mozilla.org/storage/service;1"]
        .getService(Components.interfaces.mozIStorageService);
      db = service.openDatabase(profileFile());
      db.executeSimpleSQL("CREATE TABLE IF NOT EXISTS translations (" +
        "cache_key TEXT PRIMARY KEY NOT NULL, translated TEXT NOT NULL, " +
        "touched_at INTEGER NOT NULL)");
      db.executeSimpleSQL("CREATE INDEX IF NOT EXISTS twp_cache_age " +
        "ON translations(touched_at)");
      return db;
    } catch (e) {
      disabled = true;
      try { if (db) db.close(); } catch (ignored) {}
      db = null;
      Components.utils.reportError("TWP UXP persistent cache unavailable: " + e);
      return null;
    }
  }
  function statement(sql, parameters, read) {
    var connection = storage();
    if (!connection) return null;
    var stmt = null;
    try {
      stmt = connection.createStatement(sql);
      if (parameters) Object.keys(parameters).forEach(function(k) {
        stmt.params[k] = parameters[k];
      });
      if (read) return stmt.executeStep() ? stmt.row[read] : null;
      stmt.execute();
      return true;
    } catch(e) {
      Components.utils.reportError("TWP UXP cache statement: " + e);
      return null;
    } finally {
      if (stmt) try { stmt.finalize(); } catch (ignored) {}
    }
  }
  // PrivateBrowsingUtils is supplied by the browser. Fail closed when it
  // cannot be checked: an addon must never persist content from private mode.
  function mayPersist(doc) {
    if (!enabled() || !doc || !doc.defaultView) return false;
    try {
      if (!privateUtils) {
        var imported = {};
        Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm", imported);
        privateUtils = imported.PrivateBrowsingUtils;
      }
      if (!privateUtils || typeof privateUtils.isWindowPrivate !== "function") return false;
      // The calling window is the parent browser chrome window. For translation
      // result dialogs, the operation is invoked through the parent window.
      return !privateUtils.isWindowPrivate(window);
    } catch (e) { return false; }
  }
  function cacheKey(service, src, tgt, mode, original) {
    return JSON.stringify([1, service, src, tgt, mode, original]);
  }
  function get(key) {
    var text = statement("SELECT translated FROM translations WHERE cache_key = :key",
      {key:key}, "translated");
    if (typeof text !== "string") return null;
    try {
      var value = JSON.parse(text);
      return Array.isArray(value) && value.length &&
        value.every(function(s) { return typeof s === 'string' && s.length > 0; }) ? value : null;
    } catch(e) { return null; }
  }
  function put(key, values) {
    if (!values || !values.length || !values.every(function(v) {
      return typeof v === "string" && !!v.trim();
    })) return;
    var wrote = statement("INSERT OR REPLACE INTO translations " +
      "(cache_key, translated, touched_at) VALUES (:key, :result, :date)",
      {key:key, result:JSON.stringify(values), date:Date.now()});
    if (wrote && ++writes % PRUNE_INTERVAL === 0) prune();
  }
  function prune() {
    statement("DELETE FROM translations WHERE cache_key IN (" +
      "SELECT cache_key FROM translations ORDER BY touched_at DESC " +
      "LIMIT -1 OFFSET " + MAX_ROWS + ")");
  }
  function count() {
    try {
      if (!db && !profileFile().exists()) return 0;
      return Number(statement("SELECT COUNT(*) AS total FROM translations", null, "total")) || 0;
    } catch(e) { return 0; }
  }
  function clear() {
    // Do not create a database just to delete an empty cache.
    if (!db && !profileFile().exists()) return true;
    return !!statement("DELETE FROM translations");
  }
  function close() {
    if (db) { try { db.close(); } catch (ignored) {} db = null; }
  }
  function translate(provider, mode, inputs, source, target, doc, apiKey, timeout, cb, service) {
    var fn = mode === "pieces" ? provider.translatePieces : provider.translateMany;
    if (!mayPersist(doc) || !inputs || !inputs.length) {
      fn(inputs, source, target, doc, apiKey, timeout, cb);
      return;
    }
    var originals = inputs.map(function(item) {
      return mode === "pieces" ? item.originals : [item];
    });
    var keys = originals.map(function(a) { return cacheKey(service, source, target, mode, a); });
    var outputs = new Array(inputs.length), missing = [], indexes = [];
    for (var i = 0; i < keys.length; i++) {
      var cached = get(keys[i]);
      if (cached && cached.length === originals[i].length) {
        outputs[i] = mode === "pieces" ? cached.slice() : cached[0];
      } else { missing.push(inputs[i]); indexes.push(i); }
    }
    if (!missing.length) {
      // Preserve asynchronous provider callback semantics, even on a hit.
      setTimeout(function() { cb(null, outputs); }, 0);
      return;
    }
    fn(missing, source, target, doc, apiKey, timeout, function(err, results) {
      if (err || !results || results.length !== missing.length) {
        cb(err || new Error("Incomplete translation response")); return;
      }
      var incomplete = !!results.failedSegments;
      for (var j = 0; j < indexes.length; j++) {
        var val = mode === "pieces" ? results[j] : [results[j]];
        var valid = Array.isArray(val) && val.length === originals[indexes[j]].length &&
          val.every(function(s) { return typeof s === "string" && !!s.trim(); });
        if (!valid) { cb(new Error("Invalid cached translation segment")); return; }
        outputs[indexes[j]] = mode === "pieces" ? val.slice() : val[0];
      }
      // Never persist ambiguous or partially recovered Bing responses.
      if (!incomplete && mayPersist(doc)) {
        for (var k = 0; k < indexes.length; k++) {
          var idx = indexes[k];
          put(keys[idx], mode === "pieces" ? outputs[idx] : [outputs[idx]]);
        }
      }
      if (incomplete) outputs.failedSegments = results.failedSegments;
      cb(null, outputs);
    });
  }
  return {
    translatePieces:function(provider, service, inputs, src, tgt, doc, key, timeout, cb) {
      translate(provider, "pieces", inputs, src, tgt, doc, key, timeout, cb, service);
    },
    translateMany:function(provider, service, inputs, src, tgt, doc, key, timeout, cb) {
      translate(provider, "text", inputs, src, tgt, doc, key, timeout, cb, service);
    },
    count:count, clear:clear, close:close, enabled:enabled
  };
})();
