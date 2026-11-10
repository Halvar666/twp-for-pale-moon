/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * TWP for Pale Moon – UXP native popup controller, following the upstream
 * Original / Translate + site-rules interaction model. No WebExtension APIs.
 */
var TWPUXPPopup = (function () {
  "use strict";
  var PREFIX = "extensions.twpuxp.";
  function L(key, fallback, args) {
    return typeof TWPUXPL10n !== "undefined" ?
      TWPUXPL10n.get(key, fallback, args) :
      (args ? args.reduce(function(s, item, i) {
        return s.split("{" + i + "}").join(String(item));
      }, fallback) : fallback);
  }

  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
  var cachedService = null;
  var updating = false;
  var lastStatus = null;
  function el(id) { return document.getElementById("twpuxp-popup-" + id); }
  function str(name, fallback) {
    try { return prefs.getCharPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function bool(name, fallback) {
    try { return prefs.getBoolPref(PREFIX + name); } catch (e) { return fallback; }
  }
  function set(name, value) { prefs.setCharPref(PREFIX + name, value); }
  function menuValue(name) { return TWPUXPLanguageMenus.value(el(name)); }
  function pick(name, value) { return TWPUXPLanguageMenus.choose(el(name), value); }
  function languageMenus(service) {
    if (cachedService === service) return;
    cachedService = service;
    TWPUXPLanguageMenus.populate(el("from"), true, service);
    TWPUXPLanguageMenus.populate(el("to"), false, service);
  }
  function chooseLanguages(service, from, to) {
    languageMenus(service);
    pick("from", TWPUXPLanguageCatalog.has(from, service) ? from : "auto");
    pick("to", TWPUXPLanguageCatalog.has(to, service) ? to : "cs");
  }
  function refreshFavorites(service) {
    var group = el("favorites");
    if (!group) return; // Old standalone popup test fixtures.
    var codes = typeof TWPUXPFavoriteLanguages === "undefined" ? [] :
      TWPUXPFavoriteLanguages.available(str("favoriteTargetLanguages", ""), service);
    var selected = menuValue("to");
    group.hidden = codes.length === 0;
    for (var i = 1; i <= 3; i++) {
      var button = el("favorite" + i);
      if (!button) continue;
      var code = codes[i - 1];
      button.hidden = !code;
      if (!code) { button.setAttribute("value", ""); continue; }
      var name = TWPUXPFavoriteLanguages.label(code, service);
      button.setAttribute("value", code);
      button.setAttribute("label", name);
      button.setAttribute("tooltiptext", L("favorites.buttonTip", "Set target language to {0}", [name]));
      if (code === selected) button.className = "twpuxp-favorite-active";
      else button.className = "";
    }
  }
  function chooseFavorite(n) {
    if (updating || n < 1 || n > 3) return;
    var button = el("favorite" + n);
    if (!button || button.hidden) return;
    var service = str("translationService", "google");
    var code = button.getAttribute("value");
    if (!TWPUXPLanguageMenus.has(code, false, service)) return;
    pick("to", code);
    languagesChanged(); // Existing path persists `to` and refreshes language rules.
  }
  function hostRule(name, enabled, host) {
    var parsed = TWPUXPAutoRules.parseHosts(str(name, ""), false);
    parsed = parsed.filter(function (entry) { return entry !== host; });
    if (enabled) parsed.push(host);
    set(name, parsed.join("\n"));
  }
  function hasExactRule(name, host) {
    return TWPUXPAutoRules.parseHosts(str(name, ""), false).indexOf(host) !== -1;
  }
  // Language rules are global across websites. Site exclusions take
  // precedence; preserve other configured language codes on each edit.
  function configuredLanguages(prefName) {
    var list = str(prefName || "autoTranslateLanguages", "").split(/[\s,;]+/);
    var unique = [], seen = {};
    for (var i = 0; i < list.length; i++) {
      var code = list[i];
      if (!code || seen[code]) continue;
      seen[code] = true;
      unique.push(code);
    }
    return unique;
  }
  function currentLanguage(info, service) {
    var detected = info.detected || "auto";
    var target = str("to", "cs");
    if (!info.supported || detected === "auto" || detected === target ||
        !TWPUXPLanguageCatalog.has(detected, service)) return "";
    return detected;
  }
  function refreshLanguageRule(info, service) {
    var checkbox = el("language");
    if (!checkbox) return;
    var detected = currentLanguage(info, service);
    checkbox.disabled = !detected;
    checkbox.checked = !!detected &&
      configuredLanguages("autoTranslateLanguages").indexOf(detected) !== -1;
    var never = el("neverlanguage");
    if (never) {
      never.disabled = !detected;
      never.checked = !!detected &&
        configuredLanguages("neverTranslateLanguages").indexOf(detected) !== -1;
    }
    // Display the real upstream language name when available.
    var name = detected;
    if (detected) {
      var catalog = TWPUXPLanguageCatalog.list(service);
      for (var i = 0; i < catalog.length; i++) {
        if (catalog[i][0] === detected) {
          name = catalog[i][1].replace(/ \([^)]*\)$/, "");
          break;
        }
      }
    }
    // Keep labels short even for very long upstream language names.
    // Full descriptions remain available as native XUL tooltips.
    checkbox.setAttribute("label", detected ?
      L("popup.alwaysLang", "Always translate: {0}", [name]) : L("popup.alwaysUnknown", "Always translate: language unavailable"));
    checkbox.setAttribute("tooltiptext", detected ?
      L("popup.alwaysTip", "Always automatically translate pages in {0}", [name]) :
      L("popup.unknownTip", "The language of this page could not be determined."));
    if (never) {
      never.setAttribute("label", detected ?
        L("popup.neverLang", "Never auto-translate: {0}", [name]) : L("popup.neverUnknown", "Never auto-translate: language unavailable"));
      never.setAttribute("tooltiptext", detected ?
        L("popup.neverTip", "Never automatically translate pages in {0}. Manual translation is still available.", [name]) :
        L("popup.unknownTip", "The language of this page could not be determined."));
    }
  }
  function setNotice(message) {
    var info = el("notice");
    if (info) info.setAttribute("value", message);
  }
  function refresh() {
    if (!el("main")) return;
    updating = true;
    try {
      var info = TWPUXP.getPageInfo();
      var service = str("translationService", "google");
      if (!TWPUXPProviders.has(service)) service = "google";
      var services = el("service").getElementsByTagName("menuitem");
      for (var i = 0; i < services.length; i++) {
        if (services[i].getAttribute("value") === service) {
          el("service").selectedItem = services[i]; break;
        }
      }
      chooseLanguages(service, str("from", "auto"), str("to", "cs"));
      refreshFavorites(service);
      el("original").disabled = !info.translated && !info.running;
      el("cancel").disabled = !info.running;
      el("translate").disabled = !info.supported || info.running;
      el("selection").disabled = !info.supported;
      el("always").disabled = !info.host;
      el("never").disabled = !info.host;
      el("always").checked = !!info.host && hasExactRule("autoTranslateSites", info.host);
      el("never").checked = !!info.host && hasExactRule("neverTranslateSites", info.host);
      refreshLanguageRule(info, service);
      if (el("hover")) el("hover").checked = bool("showOriginalOnHover", false);
      el("site").setAttribute("value", info.host || L("popup.noPage", "No web page available"));
      var detected = info.detected || "auto";
      var baseState = info.running ? L("popup.running", "Translating…") : (info.translated ? L("popup.translated", "Translated") : L("popup.original", "Original"));
      el("state").setAttribute("value", baseState + " · " +
        (detected === "auto" ? L("popup.unknownLanguage", "Unknown language") : L("popup.pageLanguage", "Page language: {0}", [detected])));
      if (lastStatus && info.supported && lastStatus.doc === info.document) {
        setNotice(lastStatus.message);
      } else {
        setNotice(info.supported ? L("popup.prompt", "Select a language and translate this page.") :
          L("popup.httpPrompt", "Open an HTTP(S) web page to translate."));
      }
    } finally { updating = false; }
  }
  function open(anchor) {
    var panel = el("main");
    if (!panel || !anchor) return false;
    if (panel.state === "open" || panel.state === "showing") {
      panel.hidePopup(); return true;
    }
    refresh();
    // XUL after_start aligns left edges; a right-side toolbar button
    // otherwise puts part of this 400px panel outside a narrow window.
    // after_end aligns right edges and leaves the entire panel to the left.
    var position = "after_start";
    try {
      if (anchor.getBoundingClientRect && typeof window !== "undefined") {
        var rect = anchor.getBoundingClientRect();
        if (rect.left + 400 > window.innerWidth - 12) position = "after_end";
      }
    } catch (e) { /* old XUL windows: retain default alignment */ }
    try { panel.openPopup(anchor, position, 0, 0, false, false); return true; }
    catch (e) { return false; }
  }
  function hide() { var panel = el("main"); if (panel) panel.hidePopup(); }
  function serviceChanged() {
    if (updating) return;
    var service = menuValue("service");
    if (!TWPUXPProviders.has(service)) return;
    var from = menuValue("from"), to = menuValue("to");
    set("translationService", service);
    updating = true;
    try { chooseLanguages(service, from, to); }
    finally { updating = false; }
    // A change of provider may replace unsupported language selections.
    // Save the actual visible choices and update rule availability.
    languagesChanged();
    refreshLanguageRule(TWPUXP.getPageInfo(), service);
    setNotice(L("popup.serviceChanged", "Service: {0}. It will be used for the next translation.", [service]));
  }
  function languagesChanged() {
    if (updating) return;
    set("from", menuValue("from"));
    set("to", menuValue("to"));
    refreshFavorites(str("translationService", "google"));
    refreshLanguageRule(TWPUXP.getPageInfo(), str("translationService", "google"));
  }
  function swap() {
    var from = menuValue("from"), to = menuValue("to");
    if (from === "auto") {
      setNotice(L("popup.swapAuto", "Select a specific source language before swapping.")); return;
    }
    pick("from", to); pick("to", from);
    languagesChanged();
  }
  function translate() {
    if (updating) return;
    var from = menuValue("from"), to = menuValue("to");
    languagesChanged();
    hide();
    TWPUXP.translateCurrentPage(from, to);
  }
  function restore() { hide(); TWPUXP.restoreCurrentPage(); }
  function cancel() { hide(); TWPUXP.cancelCurrentPage(); }
  function selection() { hide(); TWPUXP.translateSelectedText(); }
  function options() { hide(); TWPUXP.openOptions(); }
  function siteChanged(which) {
    if (updating) return;
    var info = TWPUXP.getPageInfo();
    if (!info.host) return;
    var enabled = !!el(which).checked;
    if (which === "always") {
      hostRule("autoTranslateSites", enabled, info.host);
      if (enabled) {
        hostRule("neverTranslateSites", false, info.host);
        prefs.setBoolPref(PREFIX + "autoTranslateEnabled", true);
      }
    } else {
      hostRule("neverTranslateSites", enabled, info.host);
      if (enabled) hostRule("autoTranslateSites", false, info.host);
    }
    refresh();
    setNotice(L("popup.siteSaved", "Site rules saved. Reload the page to apply them automatically."));
  }
  function languageRuleChanged(which) {
    if (updating) return;
    var info = TWPUXP.getPageInfo();
    var service = str("translationService", "google");
    var language = currentLanguage(info, service);
    if (!language) { refresh(); return; }
    var isNever = which === "never";
    var prefName = isNever ? "neverTranslateLanguages" : "autoTranslateLanguages";
    var opposite = isNever ? "autoTranslateLanguages" : "neverTranslateLanguages";
    var rules = configuredLanguages(prefName).filter(function(code) { return code !== language; });
    var enabled = !!el(isNever ? "neverlanguage" : "language").checked;
    if (enabled) {
      rules.push(language);
      // A language must not be simultaneously marked always and never in the popup.
      var others = configuredLanguages(opposite).filter(function(code) { return code !== language; });
      set(opposite, others.join(", "));
      if (!isNever) prefs.setBoolPref(PREFIX + "autoTranslateEnabled", true);
    }
    set(prefName, rules.join(", "));
    refresh();
    setNotice(isNever ?
      L("popup.languageExcluded", "Language exclusion saved. It overrides site auto-translation; reload to apply.") :
      L("popup.languageSaved", "Language rule saved for all sites. Exclusions take precedence; reload to apply."));
  }
  function hoverChanged() {
    if (updating) return;
    var enabled = !!el("hover").checked;
    prefs.setBoolPref(PREFIX + "showOriginalOnHover", enabled);
    TWPUXP.configureOriginalHover(enabled);
    setNotice(enabled ? L("popup.hoverOn", "Hover translated text to see its original.") :
      L("popup.hoverOff", "Original text on hover disabled."));
  }
  function onStatus(doc, message, isError) {
    lastStatus = {doc: doc, message: message, isError: !!isError};
    var panel = el("main");
    if (panel && (panel.state === "open" || panel.state === "showing")) {
      var info = TWPUXP.getPageInfo();
      if (info.document === doc) {
        setNotice(message);
        el("cancel").disabled = !info.running;
        el("translate").disabled = info.running;
        el("original").disabled = !info.translated && !info.running;
      }
    }
  }
  return {open: open, refresh: refresh, hide: hide,
    translate: translate, restore: restore, cancel: cancel,
    selection: selection, options: options, serviceChanged: serviceChanged,
    languagesChanged: languagesChanged, swap: swap, chooseFavorite: chooseFavorite, siteChanged: siteChanged,
    languageRuleChanged: languageRuleChanged, hoverChanged: hoverChanged,
    onStatus: onStatus};
})();
