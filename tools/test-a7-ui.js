/* MPL-2.0: minimal mock XUL DOM tests for a7 language preferences UI. */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'uxp', 'chrome', 'content');
function assert(x, message) { if (!x) throw Error(message); }
class FakeNode {
  constructor(tag, id='') {
    this.tag=tag; this.id=id; this.attrs={}; this.children=[];
    this.value=''; this.checked=false; this.disabled=false;
    this.textContent=''; this.selectedItem=null;
  }
  setAttribute(k,v) { this.attrs[k]=String(v); }
  getAttribute(k) { return this.attrs[k] || ''; }
  appendChild(el) { this.children.push(el); return el; }
  removeChild(el) { this.children.splice(this.children.indexOf(el),1); }
  get firstChild() {return this.children[0]||null;}
  getElementsByTagName(tag) {
    const out=[];
    for(const el of this.children){
      if(el.tag===tag)out.push(el);
      out.push(...el.getElementsByTagName(tag));
    }
    return out;
  }
}
function fakeDocument(ids) {
  const elements={};
  for(const id of ids) elements[id]=new FakeNode('box',id);
  return {
    elements,
    getElementById(id){return elements[id]||null},
    createElement(tag){return new FakeNode(tag)}
  };
}
function load(doc, names, extra={}) {
  const ctx = {document:doc, window:extra.window||{}, Components:extra.Components||{}, console};
  vm.createContext(ctx);
  for(const file of names) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  return ctx;
}
const selectionIDs=['twpuxp-selection-from','twpuxp-selection-to','twpuxp-selection-original',
 'twpuxp-selection-translation','twpuxp-selection-direction','twpuxp-selection-status',
 'twpuxp-selection-copy'];
const selDoc=fakeDocument(selectionIDs);
const waiting=[];
const calls=[];
const copied=[];
const args={original:'Hello, world!', source:'de', preferredSource:'auto', target:'cs',
 request(from,to,cb){calls.push([from,to]);waiting.push(cb)}};
const s=load(selDoc,['languageCatalog.js','languageMenus.js','selectionResult.js'],{
 window:{arguments:[args]},
 Components:{classes:{'@mozilla.org/widget/clipboardhelper;1':{getService(){return {copyString(x){copied.push(x)}}}}},interfaces:{nsIClipboardHelper:{}}}
});
s.TWPSelectionResult.init();
assert(calls.length===1&&calls[0].join(':')==='auto:cs','initial request not auto→cs');
assert(selDoc.getElementById('twpuxp-selection-copy').disabled,'copy must be disabled during request');
const from=selDoc.getElementById('twpuxp-selection-from');
const to=selDoc.getElementById('twpuxp-selection-to');
s.TWPUXPLanguageMenus.choose(from,'en');
s.TWPUXPLanguageMenus.choose(to,'fr');
s.TWPSelectionResult.run();
assert(calls[1].join(':')==='en:fr','explicit language request failed');
waiting[0](null,'Stale response');
assert(selDoc.getElementById('twpuxp-selection-translation').value==='','stale response displayed');
waiting[1](null,'Bonjour, le monde!');
assert(selDoc.getElementById('twpuxp-selection-translation').value==='Bonjour, le monde!','latest result missing');
s.TWPSelectionResult.copy();
assert(copied[0]==='Bonjour, le monde!','copy used wrong translation');
s.TWPSelectionResult.swap();
assert(calls[2].join(':')==='fr:en','swap language request failed');
waiting[2](null,'Hello world');
assert(selDoc.getElementById('twpuxp-selection-copy').disabled===false,'copy remained disabled after request');
s.TWPSelectionResult.close();
console.log('PASS a7 selected-text popup language menus, retranslation, swap, stale suppression, clipboard');

const optionIDs=['from','to','service','autoenabled','autosites','neversites','autolangs','neverlangs','privacy','diskcache','cachecount','dynamic','attributes','iframes','grouped','concurrency','batch','maxnodes'].map(x=>'twpuxp-option-'+x).concat(['twpuxp-options-error']);
const optDoc=fakeDocument(optionIDs);
const svc=optDoc.getElementById('twpuxp-option-service');
for(const name of ['google','bing']) {
  const item=new FakeNode('menuitem'); item.setAttribute('value',name);svc.appendChild(item);
}
const prefs=new Map([
 ['from','auto'],['to','cs'],['translationService','google'],['translateDynamicContent',true],
 ['useTwpParagraphEngine',true],['concurrentRequests',3],['batchSize',8],['maxNodes',0]
]);
let writes=0, closed=false;
const prefsObj={
 getCharPref(k){return prefs.get(k.replace('extensions.twpuxp.',''))},
 getIntPref(k){return prefs.get(k.replace('extensions.twpuxp.',''))},
 getBoolPref(k){return prefs.get(k.replace('extensions.twpuxp.',''))},
 setCharPref(k,v){writes++;prefs.set(k.replace('extensions.twpuxp.',''),v)},
 setIntPref(k,v){writes++;prefs.set(k.replace('extensions.twpuxp.',''),v)},
 setBoolPref(k,v){writes++;prefs.set(k.replace('extensions.twpuxp.',''),v)}
};
const o=load(optDoc,['languageCatalog.js','languageMenus.js','autoRules.js','shortcutBindings.js','persistentCache.js','options.js'],{
 window:{close(){closed=true}},
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return prefsObj}}},interfaces:{nsIPrefBranch:{}}}
});
o.TWPOptions.init();
assert(o.TWPUXPLanguageMenus.value(optDoc.getElementById('twpuxp-option-from'))==='auto','option source not initialized');
assert(o.TWPUXPLanguageMenus.value(optDoc.getElementById('twpuxp-option-to'))==='cs','option target not initialized');
optDoc.getElementById('twpuxp-option-concurrency').value='99';
o.TWPOptions.save();
assert(writes===0 && !closed,'invalid options partially persisted');
assert(optDoc.getElementById('twpuxp-options-error').textContent.includes('concurrency'),'validation error absent');
optDoc.getElementById('twpuxp-option-concurrency').value='4';
optDoc.getElementById('twpuxp-option-batch').value='12';
optDoc.getElementById('twpuxp-option-maxnodes').value='0';
o.TWPUXPLanguageMenus.choose(optDoc.getElementById('twpuxp-option-from'),'de');
o.TWPUXPLanguageMenus.choose(optDoc.getElementById('twpuxp-option-to'),'en');
optDoc.getElementById('twpuxp-option-dynamic').checked=false;
o.TWPOptions.save();
assert(closed && prefs.get('from')==='de' && prefs.get('to')==='en' &&
       prefs.get('concurrentRequests')===4 && prefs.get('maxNodes')===0 &&
       prefs.get('translateDynamicContent')===false,'saved options incorrect');
console.log('PASS a7 preferences: persisted languages and tuning, invalid input atomicity');
