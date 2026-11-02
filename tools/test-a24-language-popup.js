/* MPL-2.0. Offline XUL UI integration tests for the upstream-style main popup. */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'../uxp/chrome/content');
function assert(x, message) { if (!x) throw new Error(message); }
class FakeNode {
  constructor(tag='box', id='') {
    this.tag=tag; this.id=id; this.attrs={}; this.children=[];
    this.selectedItem=null; this.checked=false; this.disabled=false; this.state='closed';
  }
  setAttribute(k,v) { this.attrs[k]=String(v); }
  getAttribute(k) { return this.attrs[k]||''; }
  appendChild(n) { this.children.push(n);return n; }
  removeChild(n) { this.children.splice(this.children.indexOf(n),1); }
  get firstChild() { return this.children[0]||null; }
  getElementsByTagName(tag) {
    return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.getElementsByTagName(tag)]);
  }
  hidePopup() { this.state='closed'; }
  openPopup(anchor) { this.state='open';this.anchor=anchor; }
}
const ids=['main','state','notice','site','original','cancel','translate','selection','always','never','language','neverlanguage','service','from','to'];
const nodes={}; ids.forEach(id=>nodes['twpuxp-popup-'+id]=new FakeNode(id));
const doc={getElementById(id){return nodes[id]||null;},createElement(tag){return new FakeNode(tag);}};
const servicePopup = new FakeNode('menupopup');
nodes['twpuxp-popup-service'].appendChild(servicePopup);
for (const s of ['google','bing','deepl']) {
  const n=new FakeNode('menuitem');n.setAttribute('value',s);
  servicePopup.appendChild(n);
}
const raw=new Map([['translationService','google'],['from','auto'],['to','cs'],
 ['autoTranslateEnabled',false],['autoTranslateSites',''],['neverTranslateSites',''],['autoTranslateLanguages',''],['neverTranslateLanguages','']]);
function key(k){return k.replace(/^extensions\.twpuxp\./,'');}
const preferences={
  getCharPref(k){const v=raw.get(key(k));if(v===undefined)throw Error('missing pref');return v;},
  getBoolPref(k){const v=raw.get(key(k));if(v===undefined)throw Error('missing pref');return v;},
  setCharPref(k,v){raw.set(key(k),v);}, setBoolPref(k,v){raw.set(key(k),v);}
};
let page={supported:true,host:'edition.cnn.com',document:{},translated:false,running:false,detected:'en'};
let events=[];
const twp={getPageInfo:()=>page,translateCurrentPage:(f,t)=>events.push(['translate',f,t]),
 restoreCurrentPage:()=>events.push(['restore']),cancelCurrentPage:()=>events.push(['cancel']),
 translateSelectedText:()=>events.push(['selection']),openOptions:()=>events.push(['options'])};
const ctx={document:doc, navigator:{language:'en'},
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>preferences}},interfaces:{nsIPrefBranch:{}}},
 TWPUXP:twp,TWPUXPProviders:{has:s=>['google','bing','deepl'].includes(s)}, console};
vm.createContext(ctx);
for (const s of ['languageCatalog.js','languageMenus.js','autoRules.js','mainPopup.js']) {
 vm.runInContext(fs.readFileSync(path.join(root,s),'utf8'),ctx,{filename:s});
}
const p=ctx.TWPUXPPopup;
assert(p.open({})===true && nodes['twpuxp-popup-main'].state==='open','popup did not open');
assert(ctx.TWPUXPLanguageMenus.value(nodes['twpuxp-popup-to'])==='cs','target preference not shown');
assert(nodes['twpuxp-popup-original'].disabled,'original button enabled on virgin page');
assert(nodes['twpuxp-popup-state'].getAttribute('value').includes('en'),'detected page language absent');
p.open({}); assert(nodes['twpuxp-popup-main'].state==='closed','second click should close panel');
// Changing translation provider must regenerate valid language lists without requiring Preferences.
ctx.TWPUXPLanguageMenus.choose(nodes['twpuxp-popup-service'],'bing');p.serviceChanged();
assert(raw.get('translationService')==='bing','service not saved');
ctx.TWPUXPLanguageMenus.choose(nodes['twpuxp-popup-from'],'de');
ctx.TWPUXPLanguageMenus.choose(nodes['twpuxp-popup-to'],'en');
p.languagesChanged();
assert(raw.get('from')==='de'&&raw.get('to')==='en','language preferences not persisted');
p.swap(); assert(raw.get('from')==='en'&&raw.get('to')==='de','swap incorrect');
p.translate();assert(events.at(-1).join(':')==='translate:en:de','page translation not invoked');
// Per-site options update shared allow/deny rules with explicit priority.
nodes['twpuxp-popup-always'].checked=true;p.siteChanged('always');
assert(raw.get('autoTranslateEnabled')===true,'auto translation not enabled');
assert(raw.get('autoTranslateSites')==='edition.cnn.com','allow list wrong');
nodes['twpuxp-popup-never'].checked=true;p.siteChanged('never');
assert(raw.get('neverTranslateSites')==='edition.cnn.com','deny list wrong');
assert(raw.get('autoTranslateSites')==='','conflicting allow rule not removed');
assert(ctx.TWPUXPAutoRules.shouldTranslate('edition.cnn.com','en','cs',raw.get('autoTranslateSites'),raw.get('neverTranslateSites'),[])===false,'deny rule not applied');
// New a18: detected page-language rule is global; site exceptions still win.
raw.set('autoTranslateLanguages','sk, fr');
p.refresh();
assert(nodes['twpuxp-popup-language'].disabled===false,'language rule should be enabled for declared English');
assert(nodes['twpuxp-popup-language'].getAttribute('label').includes('English'),'language name missing');
nodes['twpuxp-popup-language'].checked=true;p.languageRuleChanged();
assert(raw.get('autoTranslateLanguages')==='sk, fr, en','language rule should preserve existing languages');
assert(raw.get('autoTranslateEnabled')===true,'checking a language rule should enable auto-translation');
assert(ctx.TWPUXPAutoRules.shouldTranslate('edition.cnn.com','en','de',raw.get('autoTranslateSites'),raw.get('neverTranslateSites'),['en'])===false,'site exclusion must win over language rule');
nodes['twpuxp-popup-language'].checked=false;p.languageRuleChanged();
assert(raw.get('autoTranslateLanguages')==='sk, fr','language uncheck should remove only its own rule');
page={...page,detected:'auto'};p.refresh();
assert(nodes['twpuxp-popup-language'].disabled,'unknown page language should disable option');
page={...page,detected:'de'};p.refresh();
assert(nodes['twpuxp-popup-language'].disabled,'target language must not be auto-translated');
page={...page,detected:'en'};p.refresh();
// Page state and progress are visible and unrelated tabs do not inherit status.
page={...page,translated:true,running:true};p.open({});p.refresh();
assert(nodes['twpuxp-popup-cancel'].disabled===false,'cancel should be active');
assert(nodes['twpuxp-popup-translate'].disabled===true,'translate should be blocked while running');
p.onStatus(page.document,'Translated 75/200 nodes',false);
assert(nodes['twpuxp-popup-notice'].getAttribute('value').includes('75/200'),'status did not update');
p.cancel();p.restore();p.selection();p.options();
assert(events.slice(-4).map(x=>x[0]).join(',')==='cancel,restore,selection,options','popup actions not routed');
// A24: language exclusions are independent from site rules; popup labels are dynamic.
raw.set('neverTranslateSites','');raw.set('autoTranslateSites','edition.cnn.com');
page={...page,translated:false,running:false,detected:'en'};p.refresh();
const never=nodes['twpuxp-popup-neverlanguage'];
assert(never.disabled===false,'English language exclusion unavailable');
assert(never.getAttribute('label').includes('English'),'missing localized language name');
never.checked=true;p.languageRuleChanged('never');
assert(raw.get('neverTranslateLanguages')==='en','Never English should persist');
assert(raw.get('autoTranslateLanguages')==='sk, fr','Never English should not affect other allow languages');
assert(ctx.TWPUXPAutoRules.shouldTranslate('edition.cnn.com','en','cs',
  raw.get('autoTranslateSites'),raw.get('neverTranslateSites'),['en'],['en'])===false,
  'language exclusion must override allowed site');
assert(ctx.TWPUXPAutoRules.shouldTranslate('edition.cnn.com','de','cs',
  raw.get('autoTranslateSites'),raw.get('neverTranslateSites'),[],['en'])===true,
  'different language should still auto-translate on allowed site');
// Re-enabling the positive rule removes only the conflicting negative rule.
nodes['twpuxp-popup-language'].checked=true;p.languageRuleChanged('always');
assert(raw.get('neverTranslateLanguages')==='','Always should clear matching Never');
assert(raw.get('autoTranslateLanguages')==='sk, fr, en','Always should keep other allowed codes');
// Unknown pages cannot edit either language policy.
page={...page,detected:'auto'};p.refresh();
assert(never.disabled && nodes['twpuxp-popup-language'].disabled,'unknown language controls not disabled');
console.log('PASS a24: no-auto-translate language checkbox, persistence, exclusivity, precedence');
