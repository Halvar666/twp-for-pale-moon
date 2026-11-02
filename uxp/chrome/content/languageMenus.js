/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Language chooser bridge for the full upstream TWP service catalog.
 */
var TWPUXPLanguageMenus = (function () {
  "use strict";
  function findPopup(list) {
    var popups = list.getElementsByTagName("menupopup");
    if (popups.length) return popups[0];
    var popup = document.createElement("menupopup");
    list.appendChild(popup);
    return popup;
  }
  function populate(list, withAuto, service) {
    service = service || "google";
    var old = value(list);
    var popup = findPopup(list);
    list.selectedItem = null;
    while (popup.firstChild) popup.removeChild(popup.firstChild);
    var languages = TWPUXPLanguageCatalog.list(service);
    if (withAuto) languages.unshift(["auto", "Detect automatically"]);
    languages.forEach(function (entry) {
      var item = document.createElement("menuitem");
      item.setAttribute("label", entry[1]);
      item.setAttribute("value", entry[0]);
      popup.appendChild(item);
    });
    if (old && has(old, withAuto, service)) choose(list, old);
  }
  function choose(list, code) {
    var items = findPopup(list).getElementsByTagName("menuitem");
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute("value") === code) {
        list.selectedItem = items[i];
        return true;
      }
    }
    if (items.length) list.selectedItem = items[0];
    return false;
  }
  function value(list) {
    return list && list.selectedItem ? list.selectedItem.getAttribute("value") : "";
  }
  function has(code, withAuto, service) {
    if (withAuto && code === "auto") return true;
    return TWPUXPLanguageCatalog.has(code, service || "google");
  }
  return {populate: populate, choose: choose, value: value, has: has};
})();
