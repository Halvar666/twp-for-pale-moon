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
const ids=['main','state','notice','site','original','cancel','translate','selection','always','never','service','from','to','favorites','favorite1','favorite2','favorite3'];
const nodes={}; ids.forEach(id=>nodes['twpuxp-popup-'+id]=new FakeNode(id));
const doc={getElementById(id){return nodes[id]||null;},createElement(tag){return new FakeNode(tag);}};
const servicePopup = new FakeNode('menupopup');
nodes['twpuxp-popup-service'].appendChild(servicePopup);
for (const s of ['google','bing','deepl']) {
  const n=new FakeNode('menuitem');n.setAttribute('value',s);
  servicePopup.appendChild(n);
}
const raw=new Map([['translationService','google'],['from','auto'],['to','cs'],
 ['favoriteTargetLanguages','cs,en,ace'], ['autoTranslateEnabled',false],['autoTranslateSites',''],['neverTranslateSites','']]);
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
for (const s of ['languageCatalog.js','languageMenus.js','autoRules.js','favoriteLanguages.js','mainPopup.js']) {
 vm.runInContext(fs.readFileSync(path.join(root,s),'utf8'),ctx,{filename:s});
}
const assertNode=(flag,description)=>assert(flag,description);
const prefsModule=ctx.TWPUXPFavoriteLanguages;
assertNode(prefsModule.validate(['cs','en','de'])==='cs,en,de','max 3 favorites');
assertNode(prefsModule.catalog().some(x=>x[0]==='ace'),'union of all provider catalogs');
assertNode(prefsModule.available('cs,en,ace','bing').join(',')==='cs,en','provider filtering');
assertNode(prefsModule.available('cs,en,ace','google').length===3,'google full list');
let rejected=false;
try {prefsModule.normalize('en,en');} catch(e){rejected=/Duplicate/.test(e.message);}
assertNode(rejected,'duplicate favorites rejected');
rejected=false;
try {prefsModule.normalize('en,,cs');} catch(e){rejected=true;}
assertNode(rejected,'empty embedded value rejected');
const p=ctx.TWPUXPPopup;
p.refresh();
const group=nodes['twpuxp-popup-favorites'];
const one=nodes['twpuxp-popup-favorite1'],two=nodes['twpuxp-popup-favorite2'],three=nodes['twpuxp-popup-favorite3'];
assertNode(!group.hidden && !one.hidden && !two.hidden && !three.hidden,'3 google favorites visible');
assertNode(one.getAttribute('value')==='cs' && two.getAttribute('value')==='en' && three.getAttribute('value')==='ace','code order');
assertNode(one.className==='twpuxp-favorite-active','current target is highlighted');
p.chooseFavorite(2);
assertNode(raw.get('to')==='en','favorite changes saved target language');
assertNode(two.className==='twpuxp-favorite-active','highlight follows selected target');
p.translate();
assertNode(events[events.length-1][2]==='en','page translation uses favorite target');
// On Bing one favorite is unsupported but must stay in saved list.
ctx.TWPUXPLanguageMenus.choose(nodes['twpuxp-popup-service'],'bing');
p.serviceChanged();
assertNode(raw.get('translationService')==='bing','Bing selection saved');
assertNode(!one.hidden && !two.hidden && three.hidden,'unsupported favorite hidden');
assertNode(raw.get('favoriteTargetLanguages')==='cs,en,ace','favorite prefs not erased by service switch');
p.chooseFavorite(3);
assertNode(raw.get('to')==='en','hidden favorite cannot be selected');
// Disabling all favorites restores the original b3a3 popup layout.
raw.set('favoriteTargetLanguages','');p.refresh();
assertNode(group.hidden,'no favorites => no UI row');
raw.set('favoriteTargetLanguages','en,en');p.refresh();
assertNode(group.hidden,'corrupt saved favorites handled safely');
console.log('PASS b3a4: 3 favorites, quick target switching, provider filtering, no favorites fallback');
