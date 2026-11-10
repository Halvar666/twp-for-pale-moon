/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Classic UXP selection translation window (standalone from page state).
 */
var TWPSelectionResult = (function () {
  "use strict";
  var closed = false, args = null, generation = 0;
  function L(key, fallback, args) {
    return typeof TWPUXPL10n !== "undefined" ?
      TWPUXPL10n.get(key, fallback, args) :
      (args ? args.reduce(function(s, item, i) {
        return s.split("{" + i + "}").join(String(item));
      }, fallback) : fallback);
  }

  function byId(id) { return document.getElementById(id); }
  function tell(message) { byId("twpuxp-selection-status").textContent = message; }
  function init() {
    args = window.arguments && window.arguments[0];
    if (!args || !args.original || typeof args.request !== "function") {
      tell(L("selection.none", "No selected text was provided.")); return;
    }
    var source = byId("twpuxp-selection-from"), target = byId("twpuxp-selection-to");
    TWPUXPLanguageMenus.populate(source, true, args.service || "google");
    TWPUXPLanguageMenus.populate(target, false, args.service || "google");
    TWPUXPLanguageMenus.choose(source, args.preferredSource || args.source || "auto");
    TWPUXPLanguageMenus.choose(target, args.target || "cs");
    var providerMenu = byId('twpuxp-selection-service');
    if (providerMenu) {
      // Explicitly choose a service to avoid theme-specific default selection.
      var providerItems = providerMenu.getElementsByTagName('menuitem');
      for (var i=0; i<providerItems.length; i++) {
        if (providerItems[i].getAttribute('value') === (args.service || 'google')) {
          providerMenu.selectedItem = providerItems[i];
          break;
        }
      }
    }
    byId("twpuxp-selection-original").value = args.original;
    run();
  }
  function serviceChanged() {
    var menu = byId('twpuxp-selection-service');
    var service = menu && menu.selectedItem ? menu.selectedItem.getAttribute('value') : 'google';
    var source = byId('twpuxp-selection-from'), target = byId('twpuxp-selection-to');
    var from = TWPUXPLanguageMenus.value(source), to = TWPUXPLanguageMenus.value(target);
    TWPUXPLanguageMenus.populate(source, true, service);
    TWPUXPLanguageMenus.populate(target, false, service);
    TWPUXPLanguageMenus.choose(source, TWPUXPLanguageMenus.has(from, true, service) ? from : 'auto');
    TWPUXPLanguageMenus.choose(target, TWPUXPLanguageMenus.has(to, false, service) ? to : 'cs');
  }
  function run() {
    if (closed || !args) return;
    var src = TWPUXPLanguageMenus.value(byId("twpuxp-selection-from"));
    var tgt = TWPUXPLanguageMenus.value(byId("twpuxp-selection-to"));
    var myGeneration = ++generation;
    var serviceMenu = byId('twpuxp-selection-service');
    var service = serviceMenu && serviceMenu.selectedItem ?
      serviceMenu.selectedItem.getAttribute('value') : (args.service || 'google');
    if (service !== 'google' && service !== 'bing' && service !== 'deepl') {
      tell(L("selection.invalidService", "Select a valid translation service.")); return;
    }
    if (!TWPUXPLanguageMenus.has(src, true, service) ||
        !TWPUXPLanguageMenus.has(tgt, false, service)) {
      tell(L("selection.invalidLang", "Select languages supported by {0}.", [service])); return;
    }
    byId("twpuxp-selection-direction").value = src + " → " + tgt + " (" + service + ")";
    byId("twpuxp-selection-translation").value = "";
    byId("twpuxp-selection-copy").disabled = true;
    tell(L("selection.running", "Translating…"));
    try {
      var onResult = function (error, text) {
        if (closed || myGeneration !== generation) return;
        if (error || !text) {
          tell(L("selection.failed", "Translation failed: {0}", [
            (error && error.message ? error.message : L("selection.empty", "Empty translation"))]));
          return;
        }
        byId("twpuxp-selection-translation").value = text;
        byId("twpuxp-selection-copy").disabled = false;
        tell(L("selection.done", "Translation complete ({0})", [service]));
      };
      // Keep compatibility with older 3-argument request callbacks from a7.
      if (args.request.length >= 4) args.request(src, tgt, service, onResult);
      else args.request(src, tgt, onResult);
    } catch (e) { tell(L("selection.failed", "Translation failed: {0}", [e.message])); }
  }
  function swap() {
    if (closed || !args) return;
    var from = TWPUXPLanguageMenus.value(byId("twpuxp-selection-from"));
    var to = TWPUXPLanguageMenus.value(byId("twpuxp-selection-to"));
    if (from === "auto") {
      // Auto is not a valid target language. Resolve only if page metadata
      // provides an explicit source; never invent a guessed source language.
      if (!args.source || args.source === "auto") {
        tell(L("selection.swapSource", "Choose a source language before swapping.")); return;
      }
      from = args.source;
    }
    var serviceMenu = byId('twpuxp-selection-service');
    var service = serviceMenu && serviceMenu.selectedItem ?
      serviceMenu.selectedItem.getAttribute('value') : (args.service || 'google');
    if (!TWPUXPLanguageMenus.has(from, false, service)) {
      tell(L("selection.swapUnsupported", "Select a supported source language before swapping.")); return;
    }
    TWPUXPLanguageMenus.choose(byId("twpuxp-selection-from"), to);
    TWPUXPLanguageMenus.choose(byId("twpuxp-selection-to"), from);
    run();
  }
  function copy() {
    var text = byId("twpuxp-selection-translation").value;
    if (!text) return;
    try {
      var helper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);
      helper.copyString(text);
      tell(L("selection.copied", "Copied to clipboard"));
    } catch (e) { tell(L("selection.copyFailed", "Unable to copy: {0}", [e.message])); }
  }
  function close() { closed = true; ++generation; }
  return {init: init, run: run, swap: swap, copy: copy, close: close, serviceChanged: serviceChanged};
})();
