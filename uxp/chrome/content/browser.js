/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * TWP for Pale Moon: window bootstrap (Cleanup 3).
 * Translation scheduling, selected text and browser chrome are separate
 * factory modules. The TWPUXP public interface and add-on ID are unchanged.
 */
var TWPUXP = (function () {
  "use strict";
  var P = "extensions.twpuxp.";
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
  var states = new WeakMap();
  function getDoc() {
    try { return gBrowser && gBrowser.selectedBrowser && gBrowser.selectedBrowser.contentDocument; }
    catch (e) { return null; }
  }
  function getState(doc) {
    var state = states.get(doc);
    if (!state) {
      state = {serial: 0, originals: [], running: false, observer: null,
        pendingRoots: new Set(), dynamicTimer: null, lastWritten: new WeakMap(),
        source: null, target: null, service: null, autoAttempted: false};
      states.set(doc, state);
    }
    return state;
  }
  function getString(name, fallback) { try { return prefs.getCharPref(P + name); } catch (e) { return fallback; } }
  function getBool(name, fallback) { try { return prefs.getBoolPref(P + name); } catch(e) { return fallback; } }
  function getInt(name, fallback) { try { return prefs.getIntPref(P + name); } catch (e) { return fallback; } }
  function setString(name, value) { prefs.setCharPref(P + name, value); }

  function clearPageNotice(doc, onlyNonErrors) {
    if (!doc) return;
    var el = doc.getElementById("twpuxp-status-message");
    if (!el || (onlyNonErrors && el._twpError)) return;
    if (el._twpTimeout) clearTimeout(el._twpTimeout);
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  function configureProgressIndicator(enabled) {
    // Switching off the option should remove a currently visible progress
    // notice without hiding provider errors. Other tabs' notices expire.
    if (!enabled) clearPageNotice(getDoc(), true);
  }
  function status(doc, message, isError) {
    if (!doc || !doc.body) return;
    // The browser popup keeps its status text even if the floating on-page
    // progress indicator is disabled in Preferences.
    if (typeof TWPUXPPopup !== "undefined" && TWPUXPPopup.onStatus) {
      try { TWPUXPPopup.onStatus(doc, message, isError); } catch (ignored) {}
    }
    if (!isError && !getBool("showPageProgress", false)) {
      clearPageNotice(doc, false);
      return;
    }
    var el = doc.getElementById("twpuxp-status-message");
    if (!el) {
      el = doc.createElement("div"); el.id = "twpuxp-status-message";
      el.setAttribute("data-twpuxp-ignore", "true");
      doc.body.appendChild(el);
    }
    el._twpError = !!isError;
    el.textContent = "TWP UXP: " + message;
    el.style.cssText = "position:fixed!important;z-index:2147483647!important;right:16px!important;top:16px!important;" +
      "background:" + (isError ? "#7f2929" : "#263b58") + "!important;color:white!important;" +
      "font:13px sans-serif!important;max-width:480px!important;padding:9px 12px!important;" +
      "box-shadow:0 2px 8px #0008!important;border-radius:5px!important;white-space:normal!important";
    if (el._twpTimeout) clearTimeout(el._twpTimeout);
    el._twpTimeout = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, isError ? 12000 : 5000);
  }

  var context = {P: P, prefs: prefs, states: states, getDoc: getDoc,
    getState: getState, getString: getString, getBool: getBool,
    getInt: getInt, setString: setString, status: status};
  var page = TWPUXPPageController.create(context);
  var selection = TWPUXPSelectionController.create(context);
  var chrome = TWPUXPBrowserChrome.create(context, page, selection);
  return {translateCurrentPage: page.translateCurrentPage,
    restoreCurrentPage: page.restoreCurrentPage,
    onToolbarCommand: chrome.onToolbarCommand,
    onToolbarContext: chrome.onToolbarContext,
    cancelCurrentPage: page.cancelCurrentPage,
    translateSelectedText: selection.translateSelectedText,
    getPageInfo: chrome.getPageInfo,
    openOptions: chrome.openOptions,
    configureProgressIndicator: configureProgressIndicator,
    configureOriginalHover: page.configureOriginalHover};
})();
