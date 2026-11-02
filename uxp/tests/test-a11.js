/* a11 unit and regression tests: Node.js; no external packages. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const base = path.resolve(__dirname, '../chrome/content');
const saved = Object.create(null);
function createElem(name='item') {
  return {
    nodeName: name, children: [], attrs: {}, selectedItem: null, value: '', checked: false, textContent: '',
    get firstChild(){ return this.children[0] || null; },
    appendChild(child){this.children.push(child);child.parentNode=this; return child;},
    removeChild(child){this.children.splice(this.children.indexOf(child),1); return child;},
    getElementsByTagName(tag){
      const ans=[];
      for(const c of this.children){if(c.nodeName===tag)ans.push(c);ans.push(...c.getElementsByTagName(tag));}
      return ans;
    },
    setAttribute(name, value){this.attrs[name]=String(value);},
    getAttribute(name){return this.attrs[name] || ''}
  };
}
const ids = {};
for(const id of ['from','to','service','autoenabled','autosites','neversites','autolangs','neverlangs','dynamic','attributes','iframes','grouped','concurrency','batch','maxnodes','diskcache','privacy','cachecount','cacheclear']) {
  ids['twpuxp-option-'+id] = createElem('menulist');
}
ids['twpuxp-options-error']=createElem('label');
const providers = createElem('menupopup');
for(const p of ['google','bing']) {const item=createElem('menuitem');item.setAttribute('value',p);providers.appendChild(item);}
ids['twpuxp-option-service'].appendChild(providers);
let closed=false;
const prefs={
  getCharPref(k){if(!(k in saved)) throw new Error('missing');return saved[k];},
  getBoolPref(k){if(!(k in saved)) throw new Error('missing');return saved[k];},
  getIntPref(k){if(!(k in saved)) throw new Error('missing');return saved[k];},
  setCharPref(k,v){saved[k]=v;},setBoolPref(k,v){saved[k]=v;},setIntPref(k,v){saved[k]=v;}
};
const context={navigator:{language:'cs-CZ'},console,document:{
  createElement:createElem,getElementById:(id)=>ids[id]
},window:{close(){closed=true},confirm(){return true}},TWPUXPCache:{count(){return 0},clear(){return true}},Components:{
  classes:{'@mozilla.org/preferences-service;1':{getService(){return prefs;}}},interfaces:{nsIPrefBranch:{}}
}};
vm.createContext(context);
for(const file of ['languageCatalog.js','languageMenus.js','autoRules.js','shortcutBindings.js','options.js']) {
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'), context,{filename:file});
}
const c=context.TWPUXPLanguageCatalog,r=context.TWPUXPAutoRules,m=context.TWPUXPLanguageMenus,opts=context.TWPOptions;
assert.strictEqual(c.list('google').length,250);
assert.strictEqual(c.list('bing').length,138);
assert(c.has('cs','google'));assert(c.has('cs','bing'));assert(c.has('aa','google'));assert(!c.has('aa','bing'));
assert(c.list('google').find(x=>x[0]==='cs')[1].includes('čeština'));
assert.deepStrictEqual(Array.from(r.parseHosts('https://EXAMPLE.com/page  *.news.example.com,example.com',true)), ['example.com','news.example.com']);
assert(r.matchesHost('news.example.com',['example.com']));
assert(r.matchesHost('example.com',['example.com']));
assert(!r.matchesHost('myexample.com',['example.com']));
assert(!r.matchesHost('example.com.evil.test',['example.com']));
assert(!r.shouldTranslate('news.example.com','de','cs','example.com','news.example.com',[]));
assert(r.shouldTranslate('news.example.com','de','cs','example.com','',[]));
assert(r.shouldTranslate('somewhere.net','en','cs','','',['en']));
assert(!r.shouldTranslate('somewhere.net','auto','cs','','',['en']));
assert(!r.shouldTranslate('somewhere.net','cs','cs','somewhere.net','',[]));
assert.throws(()=>r.parseHosts('example.com:443',true), /Invalid site/);
assert.throws(()=>r.parseLanguages('aa', 'bing', true), /Unsupported language/);
assert.deepStrictEqual(Array.from(r.parseLanguages('cs,de,en,de','google',true)), ['cs','de','en']);
// Service-aware menus & preferences
saved['extensions.twpuxp.from']='auto';saved['extensions.twpuxp.to']='cs';
saved['extensions.twpuxp.translationService']='google';
opts.init();
assert.strictEqual(m.value(ids['twpuxp-option-from']),'auto');
assert.strictEqual(m.value(ids['twpuxp-option-to']),'cs');
assert.strictEqual(ids['twpuxp-option-to'].getElementsByTagName('menuitem').length,250);
// switch and ensure unsupported Google-only code resets to auto for source
assert(m.choose(ids['twpuxp-option-from'],'aa'));
ids['twpuxp-option-service'].selectedItem=providers.children[1];
opts.serviceChanged();
assert.strictEqual(m.value(ids['twpuxp-option-from']),'auto');
assert.strictEqual(ids['twpuxp-option-to'].getElementsByTagName('menuitem').length,138);
ids['twpuxp-option-autosites'].value='example.com';
ids['twpuxp-option-neversites'].value='no.example.com';
ids['twpuxp-option-autolangs'].value='en,de';
ids['twpuxp-option-neverlangs'].value='fr';
ids['twpuxp-option-autoenabled'].checked=true;
ids['twpuxp-option-dynamic'].checked=true;
ids['twpuxp-option-grouped'].checked=true;
ids['twpuxp-option-concurrency'].value='3';
ids['twpuxp-option-batch'].value='8';
ids['twpuxp-option-maxnodes'].value='0';
opts.save();
assert.strictEqual(saved['extensions.twpuxp.autoTranslateSites'],'example.com');
assert.strictEqual(saved['extensions.twpuxp.neverTranslateSites'],'no.example.com');
assert.strictEqual(saved['extensions.twpuxp.autoTranslateLanguages'],'en,de');
assert.strictEqual(saved['extensions.twpuxp.neverTranslateLanguages'],'fr');
assert.strictEqual(saved['extensions.twpuxp.autoTranslateEnabled'],true);
assert.strictEqual(saved['extensions.twpuxp.translationService'],'bing');
assert(closed);
closed=false;
ids['twpuxp-option-autosites'].value='example.com:1234';
opts.save();
assert(!closed);
assert(ids['twpuxp-options-error'].textContent.includes('Invalid site'));
assert.strictEqual(saved['extensions.twpuxp.autoTranslateSites'],'example.com');
console.log('PASS: upstream catalogs (Google 250, Bing 138), language menus, domain allow/deny, language filters, invalid settings, persistence');
