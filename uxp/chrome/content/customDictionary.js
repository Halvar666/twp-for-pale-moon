/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * b3a5: Exact, case-sensitive personal terms. Text for a protected/replaced
 * term is never sent to the translator. This deliberately trades some
 * sentence context for predictable output, without fragile markup tokens.
 */
var TWPUXPCustomDictionary = (function () {
  "use strict";
  var MAX_LINES = 100, MAX_CHARS = 12000;
  function normalize(raw) {
    if (typeof raw !== "string" || raw.length > MAX_CHARS || raw.indexOf("\0") !== -1)
      throw new Error("Dictionary is too large or contains invalid characters.");
    var result = [], seen = {};
    raw.replace(/\r\n?/g, "\n").split("\n").forEach(function(line, index) {
      if (!line.trim()) return;
      var mark = line.indexOf("=>");
      if (mark < 0) throw new Error("Dictionary line " + (index + 1) + ": use source => replacement.");
      var source = line.slice(0, mark).trim(), replacement = line.slice(mark + 2).trim();
      if (!source || source.length > 120 || replacement.length > 160 || source.indexOf("=>") >= 0)
        throw new Error("Invalid dictionary entry on line " + (index + 1) + ".");
      if (Object.prototype.hasOwnProperty.call(seen, source))
        throw new Error("Duplicate dictionary source: " + source);
      seen[source] = true;
      result.push({source: source, replacement: replacement});
      if (result.length > MAX_LINES) throw new Error("Dictionary supports at most 100 entries.");
    });
    return result.map(function(r) { return r.source + " =>" + (r.replacement ? " " + r.replacement : ""); }).join("\n");
  }
  function parse(raw) {
    var canonical = normalize(raw);
    var rows = canonical ? canonical.split("\n").map(function(line) {
      var pos = line.indexOf("=>");
      return {source: line.slice(0, pos).trim(), replacement: line.slice(pos + 2).trim()};
    }) : [];
    // Longer terms take precedence (e.g. "Pale Moon" before "Moon").
    rows.sort(function(a, b) {return b.source.length - a.source.length;});
    return rows;
  }
  // nsIPrefBranch.getCharPref is 8-bit on older Gecko: use ASCII-only JSON
  // strings with Unicode escapes. Backups contain the decoded, readable text.
  function encode(raw) {
    return "v1:" + JSON.stringify(normalize(raw)).replace(/[\u007f-\uffff]/g, function(ch) {
      return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
    });
  }
  function decode(pref) {
    if (!pref) return "";
    if (pref.indexOf("v1:") !== 0) return pref; // manually edited old pref
    var parsed = JSON.parse(pref.slice(3));
    if (typeof parsed !== "string") throw new Error("Invalid dictionary preference.");
    return parsed;
  }
  function read(pref) {
    try { return parse(decode(pref)); }
    catch (ignored) { return []; } // Corrupt pref cannot break translation.
  }
  function isLatinWord(ch) { return !!ch && /[A-Za-z0-9_\u00c0-\u024f]/.test(ch); }
  function boundaryOK(text, at, source) {
    return !(isLatinWord(source[0]) && isLatinWord(text[at - 1])) &&
      !(isLatinWord(source[source.length - 1]) && isLatinWord(text[at + source.length]));
  }
  function split(text, entries) {
    text = String(text);
    if (!entries || !entries.length || !text) return null;
    var result = [], cursor = 0;
    while (cursor < text.length) {
      var best = null, pos = text.length;
      entries.forEach(function(entry) {
        var at = text.indexOf(entry.source, cursor);
        while (at !== -1 && !boundaryOK(text, at, entry.source))
          at = text.indexOf(entry.source, at + 1);
        if (at !== -1 && (at < pos || (at === pos && (!best || entry.source.length > best.source.length)))) {
          pos = at; best = entry;
        }
      });
      if (!best) break;
      if (pos > cursor) result.push({text:text.slice(cursor, pos), literal:false});
      result.push({text:best.replacement || text.slice(pos, pos + best.source.length), literal:true});
      cursor = pos + best.source.length;
    }
    if (!result.length) return null;
    if (cursor < text.length) result.push({text:text.slice(cursor), literal:false});
    return result;
  }
  // Expanding a paragraph around protected terms can produce more fragments
  // than the original provider request. Keep requests small; DeepL retains its
  // conservative 750ms pacing even for these extra fragments.
  function sendFragments(cache, provider, service, items, mode, src, tgt, doc, key, timeout, callback) {
    if (!items.length) {setTimeout(function(){callback(null, []);}, 0);return;}
    var responses = new Array(items.length), cursor = 0, failures = 0, finished = false;
    function next() {
      if (finished) return;
      if (cursor >= items.length) {
        finished = true;
        if (failures) responses.failedSegments = failures;
        callback(null, responses);
        return;
      }
      var begin = cursor, chunk = [], count = 0;
      while (cursor < items.length && chunk.length < 8) {
        var item = items[cursor];
        var chars = mode === "pieces" ? item.originals.join("").length : item.length;
        if (chunk.length && count + chars > 780) break;
        chunk.push(item);count += chars;cursor++;
      }
      var seen = false;
      function completed(err, values) {
        if (seen || finished) return;
        seen = true;
        if (err || !values || values.length !== chunk.length) {
          finished = true;
          callback(err || new Error("Incomplete dictionary fragment response"));
          return;
        }
        for (var i=0; i < chunk.length; i++) responses[begin + i] = values[i];
        if (values.failedSegments) failures += values.failedSegments;
        setTimeout(next, service === "deepl" && cursor < items.length ? 750 : 0);
      }
      if (mode === "pieces") cache.translatePieces(provider, service, chunk,
        src, tgt, doc, key, timeout, completed);
      else cache.translateMany(provider, service, chunk,
        src, tgt, doc, key, timeout, completed);
    }
    next();
  }
  function translatePieceBatch(cache, provider, service, pieces, src, tgt, doc, key, timeout, entries, cb) {
    if (!entries || !entries.length) {
      cache.translatePieces(provider, service, pieces, src, tgt, doc, key, timeout, cb); return;
    }
    var requested = [], plans = [], changed = false;
    pieces.forEach(function(piece) {
      var nodePlans = [], hasMatches = piece.originals.some(function(txt) { return !!split(txt, entries); });
      if (!hasMatches) {
        var index = requested.length;
        requested.push(piece);
        plans.push({unchanged:index});
        return;
      }
      changed = true;
      piece.originals.forEach(function(original, nodeIndex) {
        var parts = split(original, entries) || [{text:original, literal:false}];
        nodePlans.push(parts.map(function(part) {
          if (part.literal || !part.text.trim()) return {literal: part.text};
          var leading = (/^\s*/.exec(part.text) || [""])[0];
          var trailing = (/\s*$/.exec(part.text) || [""])[0];
          var clean = part.text.slice(leading.length, part.text.length - trailing.length);
          var index = requested.length;
          requested.push({nodes:[piece.nodes[nodeIndex]], originals:[clean]});
          return {index:index, leading:leading, trailing:trailing};
        }));
      });
      plans.push({nodes:nodePlans});
    });
    if (!changed) {cache.translatePieces(provider, service, pieces, src, tgt, doc, key, timeout, cb);return;}
    function assemble(err, values) {
      if (err) {cb(err);return;}
      try {
        if (!values || values.length !== requested.length) throw new Error("Incomplete dictionary translation response");
        var result = plans.map(function(plan) {
          if (Object.prototype.hasOwnProperty.call(plan,"unchanged")) return values[plan.unchanged];
          return plan.nodes.map(function(parts) {
            return parts.map(function(part) {
              if (Object.prototype.hasOwnProperty.call(part,"literal")) return part.literal;
              var translated = values[part.index];
              if (!translated || typeof translated[0] !== "string" || !translated[0].trim())
                throw new Error("Missing dictionary translation segment");
              return part.leading + translated[0].trim() + part.trailing;
            }).join("");
          });
        });
        if (values.failedSegments) result.failedSegments = values.failedSegments;
        cb(null, result);
      } catch (e) {cb(e);}
    }
    sendFragments(cache, provider, service, requested, "pieces", src, tgt, doc, key, timeout, assemble);
  }
  function translateTextBatch(cache, provider, service, texts, src, tgt, doc, key, timeout, entries, cb) {
    if (!entries || !entries.length) {cache.translateMany(provider,service,texts,src,tgt,doc,key,timeout,cb);return;}
    var requested = [], plans = [], changed = false;
    texts.forEach(function(text) {
      var parts = split(text, entries);
      if (!parts) {
        plans.push([{index:requested.length}]);requested.push(text);return;
      }
      changed = true;
      plans.push(parts.map(function(part) {
        if (part.literal || !part.text.trim()) return {literal:part.text};
        var leading = (/^\s*/.exec(part.text) || [""])[0], trailing = (/\s*$/.exec(part.text) || [""])[0];
        var clean = part.text.slice(leading.length,part.text.length - trailing.length);
        var index = requested.length;requested.push(clean);
        return {index:index,leading:leading,trailing:trailing};
      }));
    });
    if (!changed) {cache.translateMany(provider,service,texts,src,tgt,doc,key,timeout,cb);return;}
    function assemble(err, values) {
      if (err) {cb(err);return;}
      try {
        if (!values || values.length !== requested.length) throw new Error("Incomplete dictionary text response");
        cb(null,plans.map(function(parts) {return parts.map(function(part) {
          if (Object.prototype.hasOwnProperty.call(part,"literal")) return part.literal;
          var value = values[part.index];
          if (typeof value !== "string" || !value.trim()) throw new Error("Missing translated text segment");
          return (part.leading || "") + value.trim() + (part.trailing || "");
        }).join("");}));
      } catch(e){cb(e);}
    }
    sendFragments(cache, provider, service, requested, "text", src, tgt, doc, key, timeout, assemble);
  }
  return {normalize:normalize, parse:parse, encode:encode, decode:decode, read:read,
    split:split, translatePieceBatch:translatePieceBatch, translateTextBatch:translateTextBatch};
})();
