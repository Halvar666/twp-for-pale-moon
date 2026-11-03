/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// Selected-text translation, batching and dialog integration.
var TWPUXPSelectionController = (function () {
  "use strict";
  function create(context) {
  var getDoc = context.getDoc, getString = context.getString;
  var getInt = context.getInt, setString = context.setString;
  // Read the actual content selection without changing page DOM or invoking
  // the full-page translation state machine. The context-menu target is used
  // first, so selected text in a frame can be translated as well.
  function getSelectionInfo() {
    var doc = getDoc(), selected = "", selDoc = doc;
    if (!doc) return null;
    var targets = [];
    try {
      if (typeof gContextMenu !== "undefined" && gContextMenu && gContextMenu.target &&
          gContextMenu.target.ownerDocument) targets.push(gContextMenu.target.ownerDocument);
    } catch (e) {}
    targets.push(doc);
    for (var i = 0; i < targets.length; i++) {
      var d = targets[i];
      if (!d) continue;
      try {
        var element = d.activeElement;
        if (element && /^(INPUT|TEXTAREA)$/i.test(element.localName || element.nodeName) &&
            typeof element.selectionStart === "number" && typeof element.selectionEnd === "number" &&
            element.selectionEnd > element.selectionStart) {
          selected = element.value.substring(element.selectionStart, element.selectionEnd);
        } else {
          var view = d.defaultView;
          selected = view && view.getSelection ? String(view.getSelection()) : "";
        }
      } catch (e) { selected = ""; }
      if (selected && selected.trim()) { selDoc = d; break; }
    }
    return selected && selected.trim() ? {text: selected, doc: selDoc} : null;
  }

  function translateSelectedText(selectionOverride) {
    var selection = selectionOverride && selectionOverride.text ? selectionOverride : getSelectionInfo();
    if (!selection) { window.alert("Select some text on a web page first."); return; }
    var fromPreference = getString("from", "auto");
    var source = fromPreference === "auto" ?
      (TWPUXPLanguage.detectForText ? TWPUXPLanguage.detectForText(selection.doc, selection.text) :
        TWPUXPLanguage.detect(selection.doc)) : fromPreference;
    var target = getString("to", "cs");
    var layout = TWPUXPTextLayout.plan(selection.text, 780);
    var fragments = layout.fragments;
    var key = getString("apiKey", "");
    var timeout = Math.max(3000, getInt("timeoutMs", 20000));
    var selectedService = getString('translationService','google');
    if (!TWPUXPProviders.has(selectedService)) selectedService = 'google';
    var originDoc = selection.doc;
    var args = {
      original: selection.text,
      source: source,
      preferredSource: fromPreference,
      target: target,
      service: selectedService,
      // Backwards compatible with a6 request(callback). a7 also supports
      // request(chosenSource, chosenTarget, callback) from the XUL popup.
      request: function(chosenSource, chosenTarget, chosenService, callback) {
        if (typeof chosenSource === "function") {
          callback = chosenSource;
          chosenSource = fromPreference;
          chosenTarget = target;
          chosenService = selectedService;
        } else if (typeof chosenService === "function") {
          callback = chosenService;
          chosenService = selectedService;
        }
        if (typeof callback !== "function") throw new Error("Missing translation callback");
        if (!TWPUXPProviders.has(chosenService)) {
          callback(new Error("Unsupported translation service: " + chosenService)); return;
        }
        if (!chosenSource || !chosenTarget) {
          callback(new Error("Choose a source and target language")); return;
        }
        var requestSource = chosenSource === "auto" ?
          (TWPUXPLanguage.detectForText ? TWPUXPLanguage.detectForText(originDoc, selection.text) :
            TWPUXPLanguage.detect(originDoc)) : chosenSource;
        // Preserve the chosen direction for the next selection and toolbar
        // invocation, without altering the translation state of this page.
        setString("from", chosenSource);
        setString("to", chosenTarget);
        setString("translationService", chosenService);
        var provider = TWPUXPProviders.get(chosenService);
        var outputs = new Array(fragments.length);
        var nextIndex = 0, busy = 0, finished = 0, stopped = false;
        var concurrency = Math.min(3, Math.max(1, getInt("concurrentRequests", 3)));
        var batchSize = Math.min(8, Math.max(1, getInt("batchSize", 8)));
        var spacing = chosenService === "deepl" ? 750 : 0;
        if (chosenService === "deepl") concurrency = 1;
        var nextAllowed = 0, scheduledSelection = false;
        function pump() {
          if (stopped) return;
          if (finished === fragments.length) {
            stopped = true;
            try { callback(null, TWPUXPTextLayout.restore(layout, outputs)); }
            catch (layoutError) { callback(layoutError); }
            return;
          }
          while (!stopped && busy < concurrency && nextIndex < fragments.length) {
            if (spacing && Date.now() < nextAllowed) {
              if (!scheduledSelection) {
                scheduledSelection = true;
                setTimeout(function() { scheduledSelection = false; pump(); },
                  nextAllowed - Date.now());
              }
              return;
            }
            if (spacing) nextAllowed = Date.now() + spacing;
            var fromIndex = nextIndex;
            var batch = fragments.slice(nextIndex, nextIndex + batchSize);
            nextIndex += batch.length;
            busy++;
            (function(index, batchData) {
              TWPUXPCache.translateMany(provider, chosenService, batchData, requestSource,
                chosenTarget, originDoc, key, timeout,
                function(error, translated) {
                  if (stopped) return;
                  busy--;
                  if (error || !translated || translated.length !== batchData.length) {
                    stopped = true;
                    callback(error || new Error("Incomplete response from translation service"));
                    return;
                  }
                  for (var j = 0; j < translated.length; j++) outputs[index + j] = translated[j];
                  finished += translated.length;
                  pump();
                });
            })(fromIndex, batch);
          }
        }
        pump();
      }
    };
    window.openDialog("chrome://twpuxp/content/selectionResult.xul", "_blank",
      "chrome,centerscreen,resizable,dialog=no,width=660,height=500", args);
  }

  return {getSelectionInfo: getSelectionInfo,
    translateSelectedText: translateSelectedText};
  }
  return {create: create};
})();
