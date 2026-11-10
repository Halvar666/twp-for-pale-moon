/* MPL-2.0: native chrome string-bundle behavior, missing-key fallback, substitutions. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'uxp/chrome/content/l10n.js'),'utf8');
const parse=(loc)=>{
 const lines=fs.readFileSync(path.join(root,'uxp/chrome/locale/'+loc+'/twp.properties'),'ascii').split(/\r?\n/);
 const values=new Map();
 for (const line of lines) {
   const match=/^([\w.]+)=(.*)$/.exec(line);if (!match)continue;
   values.set(match[1], match[2].replace(/\\u([0-9a-fA-F]{4})/g,(_,num)=>String.fromCharCode(parseInt(num,16))).replace(/\\n/g,'\n'));
 }
 return values;
};
for (const loc of ['en-US','cs-CZ']) {
 const values=parse(loc);
 const ctx={Components:{classes:{'@mozilla.org/intl/stringbundle;1':{getService:()=>({createBundle(url){
   assert.equal(url,'chrome://twpuxp/locale/twp.properties');
   return {GetStringFromName(key){if(!values.has(key))throw Error('not found');return values.get(key);}};
 }})}},interfaces:{nsIStringBundleService:{}}}};
 vm.runInNewContext(source,ctx);
 const L=ctx.TWPUXPL10n;
 assert.equal(L.get('options.exportDone','fallback'),loc==='cs-CZ'?'Nastavení bylo úspěšně exportováno.':'Settings exported successfully.');
 assert.equal(L.get('popup.pageLanguage','fallback {0}',['cs']),loc==='cs-CZ'?'Jazyk stránky: cs':'Page language: cs');
 assert.equal(L.get('browser.alwaysHost','ignore',['$&[foo]']),loc==='cs-CZ'?'Vždy překládat $&[foo]':'Always translate $&[foo]');
 assert.equal(L.get('not.a.key','Fallback {0}',['<div>']),'Fallback <div>');
 assert.equal(L.get('browser.aboutInfo','fallback').includes('FilipePS'),true);
}
// Missing bundle: default strings are still usable by mocked/old UXP runtimes.
const other={Components:{classes:{},interfaces:{}}};vm.runInNewContext(source,other);
assert.equal(other.TWPUXPL10n.get('popup.pageLanguage','Language {0}',['en']),'Language en');
console.log('PASS b3a2: string bundles en/cs, placeholders, safe fallback');
