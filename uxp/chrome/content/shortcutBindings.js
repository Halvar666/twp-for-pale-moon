/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Shared, strictly validated shortcut representation for XUL browser/options.
 */
var TWPUXPShortcutBindings = (function () {
  "use strict";
  var actions = ["toggle", "selection", "restore"];
  var defaults = {toggle: "control,alt|T", selection: "control,alt|S",
                  restore: "alt,shift|VK_0"};
  var prefix = "extensions.twpuxp.shortcut";
  var names = {toggle: prefix + "Toggle", selection: prefix + "Selection",
               restore: prefix + "Restore"};
  var modifiers = ["control", "alt", "shift", "meta"];
  function canonical(value) {
    if (typeof value !== "string") throw new Error("Invalid shortcut value.");
    value = value.trim();
    if (!value) return "";  // Permanently disabled action.
    var parts = value.split("|");
    if (parts.length !== 2) throw new Error("Invalid shortcut format.");
    var mods = parts[0].split(","), normalized = [], seen = Object.create(null);
    for (var i=0; i<mods.length; i++) {
      var mod = mods[i].trim().toLowerCase();
      if (modifiers.indexOf(mod) < 0 || seen[mod])
        throw new Error("Invalid modifier combination.");
      seen[mod] = true;
    }
    if (!seen.control && !seen.alt && !seen.meta)
      throw new Error("Use Ctrl, Alt or Meta with a key.");
    for (var j=0; j<modifiers.length; j++)
      if (seen[modifiers[j]]) normalized.push(modifiers[j]);
    var key = parts[1].trim().toUpperCase();
    if (!/^[A-Z]$/.test(key) && !/^VK_[0-9]$/.test(key) &&
        !/^VK_F(?:[1-9]|1[0-2])$/.test(key) &&
        !/^VK_(?:HOME|END|INSERT|DELETE|UP|DOWN|LEFT|RIGHT|PAGE_UP|PAGE_DOWN)$/.test(key))
      throw new Error("Choose a letter, number, F1–F12 or navigation key.");
    return normalized.join(",") + "|" + key;
  }
  function unpack(value) {
    var normalized = canonical(value);
    if (!normalized) return {modifiers: "", key: "", keycode: ""};
    var parts = normalized.split("|");
    return {modifiers: parts[0], key: parts[1].indexOf("VK_") === 0 ? "" : parts[1],
            keycode: parts[1].indexOf("VK_") === 0 ? parts[1] : ""};
  }
  function fromEvent(event) {
    var code = Number(event.keyCode) || 0, key = "";
    if (code >= 65 && code <= 90) key = String.fromCharCode(code);
    else if (code >= 48 && code <= 57) key = "VK_" + (code - 48);
    else if (code >= 112 && code <= 123) key = "VK_F" + (code - 111);
    else {
      var special = {33: "PAGE_UP", 34: "PAGE_DOWN", 35: "END", 36: "HOME",
                     37: "LEFT", 38: "UP", 39: "RIGHT", 40: "DOWN", 45: "INSERT"};
      if (special[code]) key = "VK_" + special[code];
    }
    if (!key) return null;
    var modifiersPressed = [];
    if (event.ctrlKey) modifiersPressed.push("control");
    if (event.altKey) modifiersPressed.push("alt");
    if (event.shiftKey) modifiersPressed.push("shift");
    if (event.metaKey) modifiersPressed.push("meta");
    try { return canonical(modifiersPressed.join(",") + "|" + key); }
    catch (ignored) { return null; }
  }
  function label(value) {
    value = canonical(value);
    if (!value) return "Disabled";
    var parts=value.split("|"), names={control:"Ctrl", alt:"Alt", shift:"Shift", meta:"Meta"};
    var mods=parts[0].split(",").map(function(m){return names[m];});
    var key=parts[1].replace(/^VK_/,"").replace(/^PAGE_/,"Page ");
    return mods.concat([key]).join("+");
  }
  function validateSet(bindings) {
    var used=Object.create(null), result={};
    for (var i=0;i<actions.length;i++) {
      var action=actions[i], value=canonical(bindings[action]);
      if (value && used[value])
        throw new Error("Duplicate shortcut: " + label(value) + " is already assigned to " + used[value] + ".");
      if (value) used[value]=action;
      result[action]=value;
    }
    return result;
  }
  return {actions:actions, defaults:defaults, names:names, canonical:canonical,
    unpack:unpack, fromEvent:fromEvent, label:label, validateSet:validateSet};
})();
