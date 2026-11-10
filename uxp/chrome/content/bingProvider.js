/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. See https://mozilla.org/MPL/2.0/.
 * UXP/XUL port of FilipePS TWP v10.2.1.0 Bing translation service.
 * The Edge endpoint is an undocumented provider interface, not an official
 * Microsoft Azure Translator API. It can change or reject third-party use.
 */
var TWPBingProvider = (function () {
  "use strict";
  var endpoint = "https://edge.microsoft.com/translate/translatetext?isEnterpriseClient=false";
  var cache = new Map();
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
    var err = new Error("Bing endpoint HTTP 429 (rate limit)");
    err.httpStatus = 429;
    err.rateLimited = true;
    err.retryable = false;
    err.retryAfterMs = Math.max(0, wait);
    return err;
  }
  function normalizeLanguage(lang) {
    var map = {
      "auto":"auto-detect", "zh-CN":"zh-Hans", "zh-TW":"zh-Hant",
      "tl":"fil", "hmn":"mww", "ku":"kmr", "ckb":"ku",
      "mn":"mn-Cyrl", "no":"nb", "lg":"lug", "sr":"sr-Cyrl",
      "mni-Mtei":"mni"
    };
    return map[lang] || lang;
  }
  function escapeHTML(text) {
    return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
  }
  function wrapPiece(originals) {
    return originals.map(function(text, i) {
      return '<b' + (10+i) + '>' + escapeHTML(text) + '</b' + (10+i) + '>';
    }).join('');
  }
  function decodeResult(html, expected, doc) {
    // Microsoft can move an indexed element into a wrapper, reorder it,
    // or remove a marker when it merges a sentence. Never guess how to
    // divide a missing indexed segment; translate that group separately.
    var dom = new DOMParser().parseFromString(String(html), 'text/html');
    if (!dom || !dom.body) throw new Error('Bing returned invalid HTML');
    var outputs = new Array(expected);
    var loose = '';
    // Search inside wrappers as well as direct children. Do not descend into
    // matched <bNN> elements: their textContent already includes children.
    function walk(parent) {
      for (var i=0; i<parent.childNodes.length; i++) {
        var node = parent.childNodes[i];
        if (node.nodeType === 3) { loose += node.textContent; continue; }
        if (node.nodeType !== 1) continue;
        var match = /^b(\d+)$/i.exec(node.nodeName);
        if (match) {
          var index = Number(match[1]) - 10;
          if (index >= 0 && index < expected) {
            outputs[index] = (outputs[index] || '') + loose + node.textContent;
            loose = '';
          } else {
            loose += node.textContent;
          }
        } else {
          walk(node);
        }
      }
    }
    walk(dom.body);
    if (expected === 1 && !outputs[0] && dom.body.textContent.trim()) {
      // Even when Bing drops <b10>, one response item is unambiguous.
      return [dom.body.textContent];
    }
    if (loose && expected > 0) {
      var last = expected-1;
      outputs[last] = (outputs[last] || '') + loose;
    }
    for (var j=0;j<expected;j++) {
      if (!outputs[j] || !outputs[j].trim()) {
        throw new Error('Bing response omitted text segment ' + (j+1) + '/' + expected);
      }
    }
    return outputs;
  }
  function makeRequest(items, source, target, timeout, callback) {
    if (!items.length) {callback(null,[]); return;}
    var remaining = cooldownUntil - Date.now();
    if (remaining > 0) {callback(rateLimited(remaining));return;}
    var from=normalizeLanguage(source), to=normalizeLanguage(target);
    var url=endpoint + (from !== 'auto-detect' ? '&from=' + encodeURIComponent(from) : '')
      + '&to=' + encodeURIComponent(to);
    var req, finished=false;
    function done(err, result) { if (!finished) {finished=true; callback(err,result);} }
    try {
      req=TWPUXPPrivacyXHR.create('POST',url);
      req.timeout=timeout || 20000;
      req.setRequestHeader('Content-Type','application/json');
      req.onload=function() {
        if (req.status < 200 || req.status >= 300) {
          if (req.status === 429) {
            var after = 0;
            try { after = retryAfterMs(req.getResponseHeader('Retry-After')); }
            catch (ignore) { /* Older UXP may hide this header. */ }
            cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.max(60000, after));
            done(rateLimited(cooldownUntil - Date.now()));
            return;
          }
          var err = new Error('Bing endpoint HTTP ' + req.status);
          err.httpStatus = req.status;
          err.retryable = [408, 500, 502, 503, 504].indexOf(req.status) !== -1;
          done(err); return;
        }
        try {
          var body=JSON.parse(req.responseText);
          if (!Array.isArray(body) || body.length!==items.length)
            throw new Error('Unexpected Bing translation response length');
          var texts=body.map(function(item) {
            if (!item || !item.translations || !item.translations.length ||
                typeof item.translations[0].text !== 'string')
              throw new Error('Unexpected Bing translation response structure');
            return item.translations[0].text;
          });
          done(null,texts);
        } catch(e) { done(e); }
      };
      req.onerror=function() { var e=new Error('Bing endpoint network error (HTTP 0)');e.retryable=true;done(e); };
      req.ontimeout=function() { var e=new Error('Bing endpoint timed out');e.retryable=true;done(e); };
      req.onabort=function() { done(new Error('Bing endpoint request aborted')); };
      req.send(JSON.stringify(items));
    } catch(e) { done(e); }
  }
  // If Bing merges/drops a marker from a multi-node paragraph, repeat only
  // that paragraph as one request item per node. This is a rare slow path:
  // ordinary multi-segment paragraphs still use one fast batched request.
  function retryUnmapped(groups, pieces, source, target, timeout, onDone) {
    var individual = [];
    groups.forEach(function(groupIndex) {
      pieces[groupIndex].originals.forEach(function(value, nodeIndex) {
        individual.push({group:groupIndex, node:nodeIndex, value:value});
      });
    });
    var recovered = {}, failures = 0, at = 0;
    function next() {
      if (at >= individual.length) {onDone(null, recovered, failures);return;}
      var chunk = [], chars = 0;
      while (at < individual.length && chunk.length < 8) {
        var entry = individual[at];
        var size = entry.value.length;
        if (chunk.length && chars + size > 800) break;
        chunk.push(entry); chars += size; at++;
      }
      // Each item has exactly one marker, so a missing marker cannot make
      // the result ambiguous. No slicing by character positions is needed.
      var payload = chunk.map(function(entry) {
        return wrapPiece([entry.value]);
      });
      makeRequest(payload,source,target,timeout,function(err,texts) {
        if (err) {onDone(err);return;}
        for (var i=0;i<chunk.length;i++) {
          var item = chunk[i];
          try {
            var value = decodeResult(texts[i], 1)[0];
            if (!value || !value.trim()) throw new Error('Empty translation');
            if (!recovered[item.group]) recovered[item.group] = [];
            recovered[item.group][item.node] = value;
          } catch (parseError) {
            // Leave this node unchanged. Other groups will still complete.
            failures++;
          }
        }
        next();
      });
    }
    next();
  }

  function translatePieces(pieces, source, target, doc, unusedKey, timeout, callback) {
    if (!pieces.length) {callback(null,[]);return;}
    var output=new Array(pieces.length), miss=[], indexes=[], keys=[];
    pieces.forEach(function(p,i) {
      var key=JSON.stringify([normalizeLanguage(source),normalizeLanguage(target),p.originals]);
      keys.push(key);
      if (cache.has(key)) output[i]=cache.get(key).slice();
      else {miss.push(wrapPiece(p.originals)); indexes.push(i);}
    });
    if (!miss.length) {callback(null,output);return;}
    makeRequest(miss,source,target,timeout,function(err,texts) {
      if (err) {callback(err);return;}
      var retry=[];
      texts.forEach(function(html,j) {
        var i=indexes[j];
        try {
          var translated=decodeResult(html,pieces[i].originals.length,doc);
          output[i]=translated;
          if (cache.size >= 500) cache.clear();
          cache.set(keys[i],translated.slice());
        } catch(parseError) {
          retry.push(i);
        }
      });
      if (!retry.length) {callback(null,output);return;}
      retryUnmapped(retry,pieces,source,target,timeout,function(retryError,recovered,failures) {
        if (retryError) {callback(retryError);return;}
        retry.forEach(function(i) {
          var translated = [];
          for (var n=0;n<pieces[i].originals.length;n++) {
            // Null means skip this text node; do not replace the DOM text
            // with a misleading guess when the provider dropped a result.
            translated.push(recovered[i] && recovered[i][n] || null);
          }
          output[i] = translated;
          // Incomplete pieces must NOT enter the cache.
          if (translated.every(function(s) {return s !== null;})) {
            if (cache.size >= 500) cache.clear();
            cache.set(keys[i],translated.slice());
          }
        });
        output.failedSegments = failures;
        callback(null,output);
      });
    });
  }
  function translateMany(texts,source,target,doc,key,timeout,callback) {
    // Selection and classic DOM modes expect plain strings, not HTML arrays.
    var pieces=texts.map(function(x) {return {originals:[x]};});
    translatePieces(pieces,source,target,doc,key,timeout,function(err,result) {
      if (!err && result && result.failedSegments) {
        callback(new Error('Bing did not translate ' + result.failedSegments + ' selected-text segment(s)'));
        return;
      }
      callback(err,err?null:result.map(function(v) {return v[0];}));
    });
  }
  return {translatePieces:translatePieces,translateMany:translateMany,
    normalizeLanguage:normalizeLanguage,decodeResult:decodeResult,endpoint:endpoint};
})();
