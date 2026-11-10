/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var TWPOptions = (function () {
  "use strict";
  var PREFIX = "extensions.twpuxp.";
  function L(key, fallback, args) {
    return typeof TWPUXPL10n !== "undefined" ?
      TWPUXPL10n.get(key, fallback, args) :
      (args ? args.reduce(function(s, item, i) {
        return s.split("{" + i + "}").join(String(item));
      }, fallback) : fallback);
  }

  var shortcuts = {toggle:"", selection:"", restore:""};
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
  function byId(id) { return document.getElementById("twpuxp-option-" + id); }
  function getString(name, fallback) {
    try { return prefs.getCharPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function getBool(name, fallback) {
    try { return prefs.getBoolPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function getInt(name, fallback) {
    try { return prefs.getIntPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function favoriteList(n) { return byId("favorite" + n); }
  function initFavorites() {
    if (typeof TWPUXPFavoriteLanguages === "undefined") return;
    var favorites = TWPUXPFavoriteLanguages.list(getString("favoriteTargetLanguages", ""));
    var entries = TWPUXPFavoriteLanguages.catalog();
    for (var n = 1; n <= 3; n++) {
      var list = favoriteList(n);
      if (!list) continue;
      var popup = list.getElementsByTagName("menupopup")[0];
      if (!popup) continue;
      list.selectedItem = null;
      while (popup.firstChild) popup.removeChild(popup.firstChild);
      [["",L("favorites.none", "Not selected")]].concat(entries).forEach(function(entry) {
        var item = document.createElement("menuitem");
        item.setAttribute("value", entry[0]);
        item.setAttribute("label", entry[1]);
        popup.appendChild(item);
      });
      TWPUXPLanguageMenus.choose(list, favorites[n - 1] || "");
    }
  }
  function currentFavorites() {
    if (typeof TWPUXPFavoriteLanguages === "undefined") return "";
    var codes = [];
    for (var n = 1; n <= 3; n++) {
      var list = favoriteList(n);
      var code = list ? TWPUXPLanguageMenus.value(list) : "";
      if (code) codes.push(code);
    }
    return TWPUXPFavoriteLanguages.validate(codes);
  }
  function init() {
    var serviceList = byId('service');
    var wanted = getString('translationService','google');
    var services = serviceList.getElementsByTagName('menuitem');
    for (var i=0;i<services.length;i++) {
      if (services[i].getAttribute('value') === wanted) {
        serviceList.selectedItem = services[i]; break;
      }
    }
    if (!serviceList.selectedItem && services.length) serviceList.selectedItem = services[0];
    var service = TWPUXPLanguageMenus.value(serviceList);
    TWPUXPLanguageMenus.populate(byId("from"), true, service);
    TWPUXPLanguageMenus.populate(byId("to"), false, service);
    TWPUXPLanguageMenus.choose(byId("from"), getString("from", "auto"));
    TWPUXPLanguageMenus.choose(byId("to"), getString("to", "cs"));
    initFavorites();
    if (byId("dictionary") && typeof TWPUXPCustomDictionary !== "undefined") {
      try { byId("dictionary").value = TWPUXPCustomDictionary.decode(getString("customDictionary", "")); }
      catch (e) { byId("dictionary").value = ""; }
    }
    byId("autoenabled").checked = getBool("autoTranslateEnabled", false);
    byId("autosites").value = getString("autoTranslateSites", "");
    byId("neversites").value = getString("neverTranslateSites", "");
    byId("autolangs").value = getString("autoTranslateLanguages", "");
    byId("neverlangs").value = getString("neverTranslateLanguages", "");
    byId("privacy").checked = getBool("privacyEnhancedRequests", true);
    byId("diskcache").checked = getBool("persistentCacheEnabled", false);
    updateCacheCount();
    byId("dynamic").checked = getBool("translateDynamicContent", true);
    byId("attributes").checked = getBool("translatePageAttributes", true);
    byId("iframes").checked = getBool("translateIframes", true);
    byId("grouped").checked = getBool("useTwpParagraphEngine", true);
    if (byId("progress")) byId("progress").checked = getBool("showPageProgress", false);
    if (byId("hover")) byId("hover").checked = getBool("showOriginalOnHover", false);
    if (byId("shortcuts")) byId("shortcuts").checked = getBool("keyboardShortcutsEnabled", true);
    TWPUXPShortcutBindings.actions.forEach(function(action) {
      var model=TWPUXPShortcutBindings, raw=getString(model.names[action].slice(PREFIX.length), model.defaults[action]);
      try { shortcuts[action] = model.canonical(raw); }
      catch (ignored) { shortcuts[action] = model.canonical(model.defaults[action]); }
      renderShortcut(action);
    });
    byId("concurrency").value = getInt("concurrentRequests", 3);
    byId("batch").value = getInt("batchSize", 8);
    byId("maxnodes").value = getInt("maxNodes", 0);
    if (byId("backupkey")) byId("backupkey").checked = false; // Secrets off by default.
  }
  function updateCacheCount() {
    var n = TWPUXPCache.count();
    byId("cachecount").value = L(n === 1 ? "options.cacheCount.one" : "options.cacheCount.many",
      n === 1 ? "{0} stored translation" : "{0} stored translations", [n]);
  }
  function clearCache() {
    if (!window.confirm(L("options.cacheConfirm", "Delete all locally cached translations from this Pale Moon profile?"))) return;
    var error = document.getElementById("twpuxp-options-error");
    if (!TWPUXPCache.clear()) error.textContent = L("options.cacheFail", "Failed to clear translation cache.");
    else error.textContent = L("options.cacheSuccess", "Stored translations cleared.");
    updateCacheCount();
  }
  function serviceChanged() {
    var service = TWPUXPLanguageMenus.value(byId("service"));
    var oldSource = TWPUXPLanguageMenus.value(byId("from"));
    var oldTarget = TWPUXPLanguageMenus.value(byId("to"));
    TWPUXPLanguageMenus.populate(byId("from"), true, service);
    TWPUXPLanguageMenus.populate(byId("to"), false, service);
    TWPUXPLanguageMenus.choose(byId("from"),
      TWPUXPLanguageMenus.has(oldSource, true, service) ? oldSource : "auto");
    TWPUXPLanguageMenus.choose(byId("to"),
      TWPUXPLanguageMenus.has(oldTarget, false, service) ? oldTarget : "cs");
    document.getElementById("twpuxp-options-error").textContent = "";
  }
  function swap() {
    var source = TWPUXPLanguageMenus.value(byId("from"));
    var target = TWPUXPLanguageMenus.value(byId("to"));
    if (source === "auto") {
      document.getElementById("twpuxp-options-error").textContent =
        L("options.swapAuto", "Select an explicit source language before swapping.");
      return;
    }
    TWPUXPLanguageMenus.choose(byId("from"), target);
    TWPUXPLanguageMenus.choose(byId("to"), source);
    document.getElementById("twpuxp-options-error").textContent = "";
  }
  function validNumber(name, min, max) {
    var value = String(byId(name).value).trim();
    if (!/^[0-9]+$/.test(value)) throw new Error(L("options.numberWhole", "Enter a whole number for {0}", [name]));
    var number = Number(value);
    if (number < min || number > max) throw new Error(L("options.numberRange", "{0} must be between {1} and {2}", [name,min,max]));
    return number;
  }
  function shortcutField(action) { return document.getElementById("twpuxp-shortcut-input-" + action); }
  function shortcutError(message) {
    var element=document.getElementById("twpuxp-shortcut-error");
    if (element) { element.value=message || ""; element.textContent=message || ""; }
  }
  function renderShortcut(action) {
    var field=shortcutField(action);
    if (field) field.value=TWPUXPShortcutBindings.label(shortcuts[action]);
  }
  function setShortcut(action, value) {
    if (TWPUXPShortcutBindings.actions.indexOf(action)<0) return;
    value=TWPUXPShortcutBindings.canonical(value);
    var next={toggle:shortcuts.toggle,selection:shortcuts.selection,restore:shortcuts.restore};
    next[action]=value;
    try {TWPUXPShortcutBindings.validateSet(next);shortcutError("");}
    catch (e) {shortcutError(e.message);return;}
    shortcuts[action]=value;
    renderShortcut(action);
  }
  function captureShortcut(event,action) {
    var keyCode=Number(event.keyCode)||0;
    // Keep Tab available for moving focus through the Preferences dialog.
    if (keyCode===9) return;
    if (keyCode===27) {event.preventDefault();event.stopPropagation();shortcutError("");return;}
    if (keyCode===8 || keyCode===46) {
      event.preventDefault();event.stopPropagation();setShortcut(action,"");return;
    }
    event.preventDefault();event.stopPropagation();
    if (keyCode===16 || keyCode===17 || keyCode===18 || keyCode===91 || keyCode===92 || keyCode===93) return;
    var combo=TWPUXPShortcutBindings.fromEvent(event);
    if (!combo) {
      shortcutError(L("options.shortcutKeys", "Press Ctrl, Alt or Meta with a letter, number, F-key or navigation key."));
      return;
    }
    setShortcut(action,combo);
  }
  function clearShortcut(action) {setShortcut(action,"");}
  function resetShortcut(action) {setShortcut(action,TWPUXPShortcutBindings.defaults[action]);}
  function save() {
    var error = document.getElementById("twpuxp-options-error");
    error.textContent = "";
    try {
      var source = TWPUXPLanguageMenus.value(byId("from"));
      var target = TWPUXPLanguageMenus.value(byId("to"));
      var serviceList = byId('service');
      var service = serviceList.selectedItem ? serviceList.selectedItem.getAttribute('value') : '';
      if (service !== 'google' && service !== 'bing' && service !== 'deepl')
        throw new Error(L("options.invalidService", "Choose a valid translation service."));
      if (!TWPUXPLanguageMenus.has(source, true, service) || !TWPUXPLanguageMenus.has(target, false, service))
        throw new Error(L("options.invalidLanguages", "Choose languages supported by the selected service."));
      var autoSites = TWPUXPAutoRules.parseHosts(byId('autosites').value, true).join('\n');
      var neverSites = TWPUXPAutoRules.parseHosts(byId('neversites').value, true).join('\n');
      var autoLangs = TWPUXPAutoRules.parseLanguages(byId('autolangs').value, service, true).join(',');
      var neverLangs = TWPUXPAutoRules.parseLanguages(byId('neverlangs').value, service, true).join(',');
      var parallel = validNumber("concurrency", 1, 6);
      var batch = validNumber("batch", 1, 20);
      var limit = validNumber("maxnodes", 0, 1000000);
      var validatedShortcuts=TWPUXPShortcutBindings.validateSet(shortcuts);
      var favorites = currentFavorites(); // Reject invalid/duplicate choices before any preference write.
      var dictionary = (byId("dictionary") && typeof TWPUXPCustomDictionary !== "undefined") ?
        TWPUXPCustomDictionary.encode(byId("dictionary").value) : getString("customDictionary", "");
      // Validate all inputs before modifying any persistent preference.
      prefs.setCharPref(PREFIX + "from", source);
      prefs.setCharPref(PREFIX + "to", target);
      prefs.setCharPref(PREFIX + "favoriteTargetLanguages", favorites);
      prefs.setCharPref(PREFIX + "customDictionary", dictionary);
      prefs.setCharPref(PREFIX + "translationService", service);
      prefs.setBoolPref(PREFIX + "autoTranslateEnabled", byId("autoenabled").checked);
      prefs.setCharPref(PREFIX + "autoTranslateSites", autoSites);
      prefs.setCharPref(PREFIX + "neverTranslateSites", neverSites);
      prefs.setCharPref(PREFIX + "autoTranslateLanguages", autoLangs);
      prefs.setCharPref(PREFIX + "neverTranslateLanguages", neverLangs);
      prefs.setBoolPref(PREFIX + "privacyEnhancedRequests", byId("privacy").checked);
      prefs.setBoolPref(PREFIX + "persistentCacheEnabled", byId("diskcache").checked);
      prefs.setBoolPref(PREFIX + "translateDynamicContent", byId("dynamic").checked);
      prefs.setBoolPref(PREFIX + "translatePageAttributes", byId("attributes").checked);
      prefs.setBoolPref(PREFIX + "translateIframes", byId("iframes").checked);
      prefs.setBoolPref(PREFIX + "useTwpParagraphEngine", byId("grouped").checked);
      if (byId("progress")) {
        var progressEnabled = !!byId("progress").checked;
        prefs.setBoolPref(PREFIX + "showPageProgress", progressEnabled);
        try {
          if (window.opener && window.opener.TWPUXP &&
              typeof window.opener.TWPUXP.configureProgressIndicator === "function")
            window.opener.TWPUXP.configureProgressIndicator(progressEnabled);
        } catch (ignored) { /* Add-on manager window or closed opener. */ }
      }
      if (byId("shortcuts")) {
        TWPUXPShortcutBindings.actions.forEach(function(action){
          prefs.setCharPref(TWPUXPShortcutBindings.names[action],validatedShortcuts[action]);
        });
        prefs.setBoolPref(PREFIX + "keyboardShortcutsEnabled", !!byId("shortcuts").checked);
        // Immediate fallback for UXP builds that do not expose nsIPrefBranch2.
        try {
          if (window.opener && window.opener.TWPUXPShortcuts)
            window.opener.TWPUXPShortcuts.sync();
        } catch (ignored) {}
      }
      if (byId("hover")) {
        var hoverEnabled = !!byId("hover").checked;
        prefs.setBoolPref(PREFIX + "showOriginalOnHover", hoverEnabled);
        // The dialog is normally opened by the active browser window.
        // Apply the preview toggle immediately if that window is available.
        try {
          if (window.opener && window.opener.TWPUXP &&
              typeof window.opener.TWPUXP.configureOriginalHover === "function")
            window.opener.TWPUXP.configureOriginalHover(hoverEnabled);
        } catch (ignored) { /* Standalone add-on manager window. */ }
      }
      prefs.setIntPref(PREFIX + "concurrentRequests", parallel);
      prefs.setIntPref(PREFIX + "batchSize", batch);
      prefs.setIntPref(PREFIX + "maxNodes", limit);
      window.close();
    } catch (e) { error.textContent = e.message; }
  }
  // b3a1: Settings backup is deliberately separate from the translation cache.
  function backupStatus(message, isError) {
    var status = byId("backupstatus");
    var error = document.getElementById("twpuxp-options-error");
    status.value = isError ? "" : message;
    status.textContent = isError ? "" : message;
    error.textContent = isError ? message : "";
  }
  function chooseBackupFile(mode) {
    var Cc = Components.classes, Ci = Components.interfaces;
    var picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    picker.init(window, mode === "save" ? L("options.exportTitle", "Export TWP settings") : L("options.importTitle", "Import TWP settings"),
      mode === "save" ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen);
    picker.appendFilter(L("options.jsonFilter", "JSON settings (*.json)"), "*.json");
    picker.appendFilters(Ci.nsIFilePicker.filterAll);
    if (mode === "save") {
      picker.defaultExtension = "json";
      picker.defaultString = "twp-settings-" + new Date().toISOString().slice(0, 10) + ".json";
    }
    if (picker.show() === Ci.nsIFilePicker.returnCancel) return null;
    return picker.file;
  }
  function writeBackupFile(file, text) {
    // Safe output keeps an existing backup untouched if a write fails.
    var Cc = Components.classes, Ci = Components.interfaces;
    var stream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    stream.init(file, 0x02 | 0x08 | 0x20, 384, 0);
    var finished = false;
    try {
      var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      var bytes = converter.convertToByteArray(text, {});
      for (var pos = 0; pos < bytes.length; pos += 8192) {
        var block = bytes.slice(pos, pos + 8192);
        var binary = String.fromCharCode.apply(null, block);
        if (stream.write(binary, binary.length) !== binary.length)
          throw new Error(L("options.writeError", "Could not write the complete backup."));
      }
      stream.QueryInterface(Ci.nsISafeOutputStream).finish();
      finished = true;
    } finally {
      if (!finished) try { stream.close(); } catch (ignored) {}
    }
  }
  function readBackupFile(file) {
    if (file.fileSize > TWPUXPSettingsBackup.maxBytes)
      throw new Error(L("options.sizeError", "Backup exceeds 256 KiB."));
    var Cc = Components.classes, Ci = Components.interfaces;
    var raw = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
    raw.init(file, 0x01, 0, 0);
    var converter = null, parts = [], total = 0;
    try {
      converter = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);
      converter.init(raw, "UTF-8", 4096, 0); // 0: invalid UTF-8 is an error.
      var piece = {}, count;
      while ((count = converter.readString(4096, piece)) > 0) {
        total += piece.value.length;
        if (total > TWPUXPSettingsBackup.maxBytes)
          throw new Error(L("options.sizeError", "Backup exceeds 256 KiB."));
        parts.push(piece.value);
      }
      return parts.join("");
    } finally {
      if (converter) converter.close();
      else raw.close();
    }
  }
  function backupDeps() {
    return {menus:TWPUXPLanguageMenus, rules:TWPUXPAutoRules,
      shortcuts:TWPUXPShortcutBindings, favorites:TWPUXPFavoriteLanguages,
      dictionary:TWPUXPCustomDictionary};
  }
  function syncRestoredSettings() {
    // Preference observers are the primary update mechanism. The direct calls
    // cover older XUL builds where some observers cannot be registered.
    try {
      var opener = window.opener;
      if (!opener) return;
      if (opener.TWPUXPShortcuts) opener.TWPUXPShortcuts.sync();
      if (opener.TWPUXP) {
        if (typeof opener.TWPUXP.configureProgressIndicator === "function")
          opener.TWPUXP.configureProgressIndicator(getBool("showPageProgress", false));
        if (typeof opener.TWPUXP.configureOriginalHover === "function")
          opener.TWPUXP.configureOriginalHover(getBool("showOriginalOnHover", false));
      }
    } catch (ignored) { /* The add-ons manager is not necessarily a browser window. */ }
  }
  function exportSettings() {
    backupStatus("", false);
    try {
      var includeKey = !!byId("backupkey").checked;
      if (includeKey && !window.confirm(L("options.exportSecretConfirm", "Include the API key in a readable JSON backup? Anyone with this file can see it.")))
        return;
      var file = chooseBackupFile("save");
      if (!file) return;
      var json = TWPUXPSettingsBackup.exportJSON(prefs, includeKey);
      writeBackupFile(file, json);
      backupStatus(L("options.exportDone", "Settings exported successfully."), false);
    } catch (e) { backupStatus(L("options.exportError", "Export failed: {0}", [e.message]), true); }
  }
  function importSettings() {
    backupStatus("", false);
    try {
      var file = chooseBackupFile("open");
      if (!file) return;
      // No preference is changed until the entire input is validated.
      var values = TWPUXPSettingsBackup.decode(readBackupFile(file), prefs, backupDeps());
      if (!window.confirm(L("options.importConfirm", "Restore {0} settings from this file? Existing saved preferences will be overwritten and unsaved dialog changes discarded.", [Object.keys(values).length])))
        return;
      var restoreKey = false;
      if (Object.prototype.hasOwnProperty.call(values, "apiKey")) {
        restoreKey = window.confirm(L("options.importSecretConfirm", "The backup contains an API key. Restore this sensitive value too? Choose Cancel to keep the current key."));
      }
      var count = TWPUXPSettingsBackup.restore(prefs, values, restoreKey);
      init(); // Refresh the fields from the restored preferences.
      syncRestoredSettings();
      backupStatus(L("options.importDone", "Restored {0} settings. Reopen other browser windows if needed.", [count]), false);
    } catch (e) { backupStatus(L("options.importError", "Import failed: {0}", [e.message]), true); }
  }
  return {init: init, swap: swap, save: save, serviceChanged: serviceChanged,
    clearCache: clearCache, captureShortcut:captureShortcut,
    clearShortcut:clearShortcut, resetShortcut:resetShortcut,
    exportSettings:exportSettings, importSettings:importSettings};
})();
