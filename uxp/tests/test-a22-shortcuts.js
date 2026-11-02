/* MPL-2.0: regression checks for the a22 native mainKeyset fix. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'chrome/content/shortcuts.js'),'utf8');
const xul=fs.readFileSync(path.join(root,'chrome/content/browserOverlay.xul'),'utf8');
assert.match(xul,/<keyset id="mainKeyset">/);
assert.doesNotMatch(xul,/<keyset id="twpuxp-shortcuts">/);
for(const id of ['toggle','selection','restore'])
  assert.match(xul,new RegExp('id="twpuxp-shortcut-'+id+'"'));
assert.match(src,/document\.getElementById\("mainKeyset"\)/);
assert.match(src,/keyset\.appendChild\(key\)/);
assert.match(src,/keyset\.replaceChild\(replacement, key\)/);
assert.match(src,/keyset\.parentNode\.appendChild\(keyset\)/);
console.log('PASS a22 compatibility: native mainKeyset preserved and refreshed after rebinding');
