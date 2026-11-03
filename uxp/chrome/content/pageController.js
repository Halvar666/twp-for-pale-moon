/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// Page collection, dynamic content, translation scheduling, rollback.
// Created once per browser window; the original a29 implementation is kept intact.
var TWPUXPPageController = (function () {
  "use strict";
  function create(context) {
  var getDoc = context.getDoc, getState = context.getState;
  var getBool = context.getBool, getInt = context.getInt;
  var getString = context.getString, setString = context.setString;
  var status = context.status, prefs = context.prefs, P = context.P;
  function collectNodes(doc, maxNodes) {
    var found = [], walker;
    try { walker = doc.createTreeWalker(doc.body, 4, null, false); }
    catch (e) { return found; }
    var node, skip = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|KBD|SAMP|SVG|MATH)$/;
    var limit = (maxNodes > 0) ? maxNodes : Infinity;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      var parent = node.parentNode, ignore = false;
      while (parent && parent !== doc.body) {
        if (skip.test(parent.nodeName) || parent.isContentEditable ||
            (parent.getAttribute && (parent.getAttribute("translate") === "no" || parent.getAttribute("data-twpuxp-ignore") !== null ||
            (parent.classList && parent.classList.contains("notranslate"))))) { ignore = true; break; }
        parent = parent.parentNode;
      }
      if (!ignore) found.push(node);
      if (found.length >= limit) break;
    }
    return found;
  }


  // Keep all text nodes, translated attributes, and accessible child frames in
  // one scheduler / rollback log. This deliberately does NOT cross origins.
  function collectDocuments(topDoc) {
    var found = [topDoc], seen = new Set([topDoc]);
    if (!getBool("translateIframes", true)) return found;
    var origin;
    try {
      origin = [topDoc.location.protocol, topDoc.location.hostname,
        topDoc.location.port].join("|");
    } catch (e) { return found; }
    for (var i = 0; i < found.length && found.length <= 20; i++) {
      var parent = found[i], frames;
      try { frames = parent.querySelectorAll("iframe,frame"); }
      catch (e) { continue; }
      for (var j = 0; j < frames.length && found.length <= 20; j++) {
        try {
          var child = frames[j].contentDocument;
          if (!child || !child.body || seen.has(child) ||
              !/^https?:$/.test(child.location.protocol) ||
              [child.location.protocol, child.location.hostname,
                child.location.port].join("|") !== origin) continue;
          seen.add(child); found.push(child);
        } catch (e) { /* Cross-origin or inaccessible; never force access. */ }
      }
    }
    return found;
  }
  function collectPiecesInDocument(doc, maxNodes, grouped, root, ignoreText) {
    var pieces = grouped ? TWPUXPPageTranslator.collect(doc, maxNodes, root, ignoreText) :
      (root ? (root.nodeType === 3 ? [root] : collectNodesFromRoot(doc, root, maxNodes)) :
        collectNodes(doc, maxNodes))
      .filter(function(n) { return !ignoreText || !ignoreText(n); })
      .map(function(n) { return {nodes: [n], originals: [n.nodeValue]}; });
    if (getBool("translatePageAttributes", true)) {
      var budget = maxNodes > 0 ? Math.max(0, maxNodes - pieces.reduce(function(n, p) {
        return n + p.nodes.length;
      }, 0)) : 0;
      if (maxNodes <= 0 || budget > 0)
        pieces = pieces.concat(TWPUXPAttributes.collect(doc, root || doc.body,
          ignoreText, budget));
    }
    return pieces;
  }

  function stopDynamic(state) {
    if (state.observer) { state.observer.stop(); state.observer = null; }
    if (state.dynamicTimer !== null) clearTimeout(state.dynamicTimer);
    state.dynamicTimer = null;
    state.pendingRoots.clear();
  }

  // Observe only after the user explicitly starts translating this tab.
  // Additions during the first translation are buffered and picked up later.
  function startDynamic(doc, state) {
    stopDynamic(state);
    if (!getBool("translateDynamicContent", true)) return;
    var observers = collectDocuments(doc).map(function(watchedDoc) {
      return TWPUXPDynamic.watch(watchedDoc, function (roots) {
        roots.forEach(function(root) { state.pendingRoots.add(root); });
        scheduleDynamic(doc, state);
      }, function (node) {
        return state.lastWritten.get(node) === node.nodeValue;
      }, function (element, name) {
        var proxy = TWPUXPAttributes.descriptor(element, name);
        return state.lastWritten.get(proxy) === proxy.nodeValue;
      });
    }).filter(Boolean);
    if (observers.length) state.observer = {stop: function() {
      observers.forEach(function(ob) { ob.stop(); });
    }};
  }

  function scheduleDynamic(doc, state) {
    if (!state.observer || !state.pendingRoots.size || state.running || state.dynamicTimer !== null) return;
    state.dynamicTimer = setTimeout(function () {
      state.dynamicTimer = null;
      if (state.running || !state.observer || !state.pendingRoots.size) return;
      var roots = Array.from(state.pendingRoots);
      state.pendingRoots.clear();
      var seen = new Set(), pieces = [], maxNodes = getInt("maxNodes", 0),
          grouped = getBool("useTwpParagraphEngine", true);
      var remaining = maxNodes > 0 ? maxNodes : Infinity;
      for (var i = 0; i < roots.length && remaining > 0; i++) {
        var root = roots[i];
        // A root may belong to an accessible child frame, not just topDoc.
        var rootDoc = root && (root.ownerDocument || doc);
        try { if (!root || !rootDoc || !rootDoc.body ||
              (root !== rootDoc.body && !rootDoc.body.contains(root))) continue; }
        catch (e) { continue; }
        var ignoreAlreadyWritten = function(n) {
          return state.lastWritten.get(n) === n.nodeValue;
        };
        var list = collectPiecesInDocument(rootDoc, remaining === Infinity ? 0 : remaining,
          grouped, root, ignoreAlreadyWritten);
        list.forEach(function(piece) {
          // ChildList and characterData events can overlap: never translate
          // the same DOM text node twice in a dynamic update pass.
          var nodes = [], originals = [];
          piece.nodes.forEach(function(n, j) {
            if (!seen.has(n) && remaining > 0) {
              seen.add(n); nodes.push(n); originals.push(piece.originals[j]); remaining--;
            }
          });
          if (nodes.length) pieces.push({nodes: nodes, originals: originals});
        });
      }
      if (pieces.length && state.source && state.target) {
        translateCurrentPage(state.source, state.target, {doc: doc, dynamicPieces: pieces});
      }
    }, 150);
  }

  function collectNodesFromRoot(doc, root, limit) {
    // The classic fallback is intentionally simple; the TWP grouping engine
    // remains the preferred mode for newly appended document fragments.
    var pieces = TWPUXPPageTranslator.collect(doc, limit, root);
    var nodes = [];
    pieces.forEach(function(p) { p.nodes.forEach(function(n) { nodes.push(n); }); });
    return nodes;
  }

  function restoreCurrentPage() {
    var doc = getDoc(); if (!doc) return;
    var state = getState(doc); state.serial++; state.running = false;
    stopDynamic(state);
    if (typeof TWPUXPOriginalHover !== "undefined") TWPUXPOriginalHover.stop(state);
    var done = 0;
    for (var i = state.originals.length - 1; i >= 0; i--) {
      var r = state.originals[i];
      if (r.node && r.node.parentNode && r.node.nodeValue === r.translated) {
        r.node.nodeValue = r.original;
        done++;
      }
    }
    state.originals = [];
    state.lastWritten = new WeakMap();
    status(doc, "Original text restored (" + done + " nodes)", false);
  }

  function translateCurrentPage(from, to, options) {
    options = options || {};
    var doc = options.doc || getDoc();
    if (!doc || !doc.body || !/^https?:$/.test(doc.location.protocol)) {
      window.alert("TWP for Pale Moon: Open a normal http(s) web page first."); return;
    }
    var isDynamic = !!options.dynamicPieces;
    var requestedSource = options.automatic ? TWPUXPLanguage.detect(doc) :
      (from || getString("from", "auto"));
    if (options.automatic && !TWPUXPLanguageCatalog.has(requestedSource,
        getString('translationService','google'))) requestedSource = 'auto';
    to = to || getString("to", "cs");
    var state = getState(doc);
    if (state.running) { if (!isDynamic) status(doc, "Translation is already running", false); return; }
    if (!isDynamic && state.originals.length) restoreCurrentPage();
    if (!isDynamic && !options.automatic) {
      // An explicit source selected in the toolbar menu is remembered.
      // "auto" first uses the page's <html lang> / content-language metadata;
      // if absent, the translation provider detects it from text content.
      setString("from", requestedSource);
      setString("to", to);
    }
    // For manual translation, a Japanese/other CJK document embedded in an
    // English-language website must not be forced to translate from English.
    // Auto-translation rules continue to rely on declared page metadata.
    from = requestedSource === "auto" ? TWPUXPLanguage.detect(doc) : requestedSource;
    var service = isDynamic ? (state.service || 'google') : getString('translationService','google');
    if (!TWPUXPProviders.has(service)) service = 'google';
    if (!isDynamic) { state.source = from; state.target = to; state.service = service; }

    // A zero limit means translate the whole page. Nonzero values remain
    // available as a user-configurable safety valve for unusually large sites.
    var maxNodes = getInt("maxNodes", 0);
    var grouped = getBool("useTwpParagraphEngine", true);
    var pieces = isDynamic ? options.dynamicPieces : [];
    if (!isDynamic) {
      var documents = collectDocuments(doc), left = maxNodes > 0 ? maxNodes : Infinity;
      for (var di = 0; di < documents.length && left > 0; di++) {
        var part = collectPiecesInDocument(documents[di], left === Infinity ? 0 : left, grouped);
        pieces = pieces.concat(part);
        if (left !== Infinity) left -= part.reduce(function(n, p) { return n + p.nodes.length; }, 0);
      }
    }
    if (!pieces.length) {
      if (!isDynamic) status(doc, "No eligible text nodes on this page", true);
      return;
    }
    if (!options.automatic && !isDynamic && requestedSource === "auto" &&
        typeof TWPUXPLanguage.detectForText === "function") {
      var sourceSample = "";
      for (var sampleIndex = 0; sampleIndex < pieces.length && sourceSample.length < 24000; sampleIndex++)
        sourceSample += pieces[sampleIndex].originals.join(" ") + " ";
      from = TWPUXPLanguage.detectForText(doc, sourceSample);
      // Dynamic translation reuses state.source; keep it consistent with the
      // source language actually sent to the provider on the initial page.
      state.source = from;
    }
    pieces = TWPUXPPageTranslator.prioritizeVisible(pieces, doc);
    if (!isDynamic) {
      startDynamic(doc, state);
      if (typeof TWPUXPOriginalHover !== "undefined")
        TWPUXPOriginalHover.start(doc, state, collectDocuments(doc),
          getBool("showOriginalOnHover", false));
    }
    var provider = TWPUXPProviders.get(service);
    var totalNodes = pieces.reduce(function(acc, p) { return acc + p.nodes.length; }, 0);
    var batchSize = Math.min(20, Math.max(1, getInt("batchSize", 8)));
    var concurrency = Math.min(6, Math.max(1, getInt("concurrentRequests", 3)));
    var timeout = Math.max(3000, getInt("timeoutMs", 20000));
    var delay = Math.max(0, getInt("requestDelayMs", 0));
    // The anonymous DeepL endpoint has undocumented request limits.
    // Keep DeepL serialized with 750ms pacing; do not retry rate-limited requests.
    // Google/Bing retain their existing parallel scheduling.
    if (service === "deepl") { concurrency = 1; delay = Math.max(delay, 750); }
    var token = ++state.serial;
    state.running = true;
    var index = 0, inFlight = 0, completed = 0, finishedGroups = 0, skippedNodes = 0;
    var failedGroups = 0, transientFailures = 0, totalTransientFailures = 0, failureStatus = '';
    var lastMessage = 0, nextAllowedDispatch = 0, scheduled = false;
    var stopOnError = true;
    status(doc, (isDynamic ? "Updating " : "Translating ") + from + " → " + to + " (" + totalNodes +
      " nodes / " + pieces.length + " groups, " + (grouped ? "TWP" : "classic") +
      ", " + concurrency + " requests in parallel, " + service + ")", false);

    function isActive() { return token === state.serial && state.running; }
    function progress(force) {
      var now = Date.now();
      if (force || now - lastMessage >= 400) {
        lastMessage = now;
        status(doc, "Translated " + completed + "/" + totalNodes +
          " nodes (" + finishedGroups + "/" + pieces.length + " groups)", false);
      }
    }
    function schedulePump(wait) {
      if (!isActive() || scheduled) return;
      scheduled = true;
      setTimeout(function () { scheduled = false; pump(); }, Math.max(0, wait));
    }
    // Preserve line layout for a single multiline text node inside <pre>.
    // The provider only receives nonempty segments; separators stay local.
    // All other DOM nodes retain the existing fast paragraph algorithm.
    function isPreformatted(piece) {
      if (piece.nodes.length !== 1 || !/[\r\n]/.test(piece.originals[0])) return false;
      var parent = piece.nodes[0].parentNode;
      while (parent && parent !== doc.body) {
        if (parent.nodeName === "PRE") return true;
        parent = parent.parentNode;
      }
      return false;
    }
    function translateWithLayout(batch, callback) {
      if (typeof TWPUXPTextLayout === "undefined" ||
          !batch.some(isPreformatted)) {
        TWPUXPCache.translatePieces(provider, service, batch, from, to, doc,
          getString("apiKey", ""), timeout, callback);
        return;
      }
      var expanded = [], mapping = [];
      batch.forEach(function(piece) {
        if (!isPreformatted(piece)) {
          mapping.push({index: expanded.length});
          expanded.push(piece);
          return;
        }
        var layout = TWPUXPTextLayout.plan(piece.originals[0], 780);
        if (!layout.fragments.length) {
          // Not useful to translate a whitespace-only block.
          mapping.push({index: expanded.length});
          expanded.push(piece);
          return;
        }
        mapping.push({start: expanded.length, count: layout.fragments.length, layout: layout});
        layout.fragments.forEach(function(text) {
          // Keep a one-to-one nodes[]/originals[] contract for all providers.
          // Google uses nodes.length to decode indexed response segments.
          // This reference is metadata only; the original PRE node is written
          // once, after all the translated lines have been reassembled.
          expanded.push({nodes: [piece.nodes[0]], originals: [text]});
        });
      });
      var responses = new Array(expanded.length), cursor = 0, totalFailed = 0;
      function next() {
        if (!isActive()) return;
        if (cursor >= expanded.length) {
          try {
            var assembled = mapping.map(function(item) {
              if (!item.layout) return responses[item.index];
              var values = responses.slice(item.start, item.start + item.count)
                .map(function(a) { return a && a[0]; });
              return [TWPUXPTextLayout.restore(item.layout, values)];
            });
            if (totalFailed) assembled.failedSegments = totalFailed;
            callback(null, assembled);
          } catch (e) { callback(e); }
          return;
        }
        var chunk = [], size = 0;
        while (cursor < expanded.length && chunk.length < 8) {
          var item = expanded[cursor], length = item.originals.join("").length;
          if (chunk.length && size + length > 780) break;
          chunk.push(item); size += length; cursor++;
        }
        var at = cursor - chunk.length;
        TWPUXPCache.translatePieces(provider, service, chunk, from, to, doc,
          getString("apiKey", ""), timeout, function(err, translated) {
            if (!isActive()) return;
            if (err || !translated || translated.length !== chunk.length) {
              callback(err || new Error("Incomplete preformatted text response"));
              return;
            }
            for (var i = 0; i < translated.length; i++) responses[at + i] = translated[i];
            if (translated.failedSegments) totalFailed += translated.failedSegments;
            if (service === "deepl" && cursor < expanded.length) setTimeout(next, 750);
            else setTimeout(next, 0); // no deep recursion on synchronous cache hits
          });
      }
      next();
    }
    function pump() {
      if (!isActive()) return;
      if (index >= pieces.length && inFlight === 0) {
        state.running = false;
        status(doc, (isDynamic ? "Dynamic content updated: " : "Finished: ") +
          completed + "/" + totalNodes + " text nodes (" + pieces.length + " groups)" +
          (skippedNodes ? "; " + skippedNodes + " untranslated node(s)" : "") +
          (failedGroups ? " in " + failedGroups + " failed group(s)" : ""),
          skippedNodes > 0);
        scheduleDynamic(doc, state);
        return;
      }
      while (isActive() && inFlight < concurrency && index < pieces.length) {
        // Delay is optional for self-hosted/rate-limited endpoints. Our
        // default for the Google provider is zero, unlike a3's 300ms pause.
        var remaining = nextAllowedDispatch - Date.now();
        if (remaining > 0) { schedulePump(remaining); return; }
        var chunk = [], chars = 0;
        while (index < pieces.length && chunk.length < batchSize) {
          var piece = pieces[index];
          var n = piece.originals.join("").length;
          if (chunk.length && chars + n > 800) break;
          chunk.push(piece);
          index++; chars += n;
        }
        if (delay) nextAllowedDispatch = Date.now() + delay;
        inFlight++;
        (function(batch, batchStart) {
          // Network adapters should settle once. Guard against duplicate
          // onload/onerror notifications so the queue count never underflows
          // and a translated segment cannot be committed twice.
          var settled = false;
          function done(err, results) {
            if (settled) return;
            settled = true;
            if (!isActive()) return; // Restore/Cancel invalidates old responses.
            inFlight--;
            if (err) {
              if (service === "deepl" && (err.rateLimited || err.httpStatus === 429)) {
                state.running = false;
                ++state.serial;
                stopDynamic(state);
                status(doc, "DeepL has limited translation requests (HTTP 429). " +
                  "Stopped after " + completed + "/" + totalNodes +
                  " translated nodes. Choose Google or Bing, or try DeepL later.", true);
                return;
              }
              if (err.retryable) {
                // A single gateway error must not discard the rest of the page.
                // Keep original nodes in the failed batch and process the rest.
                failedGroups += batch.length;
                var failedNodeCount = batch.reduce(function(sum, p) {
                  return sum + p.nodes.length;
                }, 0);
                skippedNodes += failedNodeCount;
                transientFailures++;
                totalTransientFailures++;
                failureStatus = err.message;
                if (transientFailures >= 4 || totalTransientFailures >= 8) {
                  // Circuit breaker: don't hammer an unavailable upstream.
                  state.running = false;
                  ++state.serial;
                  stopDynamic(state);
                  status(doc, "Translation provider temporarily unavailable (" + failureStatus +
                    "). Stopped after " + totalTransientFailures + " failed batches; " +
                    completed + " nodes translated. Try Bing or translate again later.", true);
                } else {
                  status(doc, "Temporary " + service + " error (" + failureStatus +
                    "): left " + failedNodeCount + " nodes unchanged; continuing…", true);
                  schedulePump(0);
                }
              } else if (stopOnError) {
                state.running = false;
                ++state.serial; // invalidate other outstanding callbacks
                stopDynamic(state);
                status(doc, "Stopped at group " + (batchStart + 1) +
                  "/" + pieces.length + " after " + completed + " nodes: " + err.message, true);
              }
              return;
            }
            transientFailures = 0;
            try {
              if (!results || results.length !== batch.length)
                throw new Error("Incomplete translation response");
              if (results.failedSegments) skippedNodes += results.failedSegments;
              batch.forEach(function(p, i) {
                var previous = state.originals.length;
                if (grouped) {
                  completed += TWPUXPPageTranslator.apply(p, results[i], state.originals);
                } else {
                  var node = p.nodes[0], old = p.originals[0];
                  if (!node.parentNode || node.nodeValue !== old || !results[i]) return;
                  var trans = old.replace(old.trim(), results[i]);
                  if (trans !== old) {
                    state.originals.push({node: node, original: old, translated: trans});
                    node.nodeValue = trans;
                    completed++;
                  }
                }
                for (var n = previous; n < state.originals.length; n++) {
                  var entry = state.originals[n];
                  state.lastWritten.set(entry.node, entry.translated);
                  if (typeof TWPUXPOriginalHover !== "undefined")
                    TWPUXPOriginalHover.remember(state, entry);
                }
              });
              finishedGroups += batch.length;
            } catch (e) {
              state.running = false;
              ++state.serial;
              stopDynamic(state);
              status(doc, "Could not map translated segments: " + e.message, true);
              return;
            }
            progress(false);
            schedulePump(0);
          }
          try {
            if (grouped) {
              translateWithLayout(batch, done);
            } else {
              TWPUXPCache.translateMany(provider, service, batch.map(function(p) {
                return p.originals[0].trim();
              }), from, to, doc, getString("apiKey", ""), timeout, done);
            }
          } catch (e) {
            // E.g. a missing XPCOM network service or a provider bootstrap
            // exception before the asynchronous callback is installed.
            // Surface the failure and invalidate other outstanding batches.
            done(e);
          }
        })(chunk, index - chunk.length);
        // If a synchronous cache hit completed immediately, schedule a
        // nonrecursive continuation rather than spin the event loop.
        if (delay) { schedulePump(delay); return; }
      }
    }
    pump();
  }

  function cancelCurrentPage() {
    var doc = getDoc(); if (!doc) return;
    var state = getState(doc);
    if (!state.running) { status(doc,"No translation running",false); return; }
    state.serial++; state.running = false;
    stopDynamic(state);
    status(doc,"Translation cancelled (already translated text preserved)",false);
  }
  function configureOriginalHover(enabled) {
    // Can be toggled immediately for the active translated page in the
    // toolbar popup. Preferences for other tabs apply on next translation.
    var doc = getDoc();
    if (!doc) return;
    var state = getState(doc);
    if (typeof TWPUXPOriginalHover === "undefined") return;
    if (enabled && (state.running || state.originals.length)) {
      TWPUXPOriginalHover.start(doc, state, collectDocuments(doc), true);
    } else {
      TWPUXPOriginalHover.stop(state);
    }
  }
  function toggleEngine() {
    var nextValue = !getBool("useTwpParagraphEngine", true);
    prefs.setBoolPref(P + "useTwpParagraphEngine", nextValue);
    var doc = getDoc();
    if (doc) status(doc, "Engine: " + (nextValue ? "TWP paragraph grouping" : "classic single-node fallback"), false);
  }
  return {collectDocuments: collectDocuments, startDynamic: startDynamic,
    stopDynamic: stopDynamic, translateCurrentPage: translateCurrentPage,
    restoreCurrentPage: restoreCurrentPage, cancelCurrentPage: cancelCurrentPage,
    configureOriginalHover: configureOriginalHover, toggleEngine: toggleEngine};
  }
  return {create: create};
})();
