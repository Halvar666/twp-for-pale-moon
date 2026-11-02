/* MPL-2.0: regression checks for the three a21 keyboard commands, now rebindable. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'chrome/content/shortcuts.js'),'utf8');
const xul=fs.readFileSync(path.join(root,'chrome/content/browserOverlay.xul'),'utf8');
const prefs=fs.readFileSync(path.join(root,'defaults/preferences/defaults.js'),'utf8');
for (const cmd of ['toggle','selection','restore']) {
  assert.match(src,new RegExp('action === "'+cmd+'"'));
  assert.match(xul,new RegExp('TWPUXPShortcuts\\.run\\(\''+cmd+'\'\\)'));
}
assert.match(src,/keyboardShortcutsEnabled/);
assert.match(prefs,/keyboardShortcutsEnabled", true/);
assert.match(src,/restoreCurrentPage\(/);
assert.match(src,/translateSelectedText\(/);
assert.match(src,/translateCurrentPage\(/);
console.log('PASS a21 compatibility: toggle, selection, restore, master toggle and preserved commands');
