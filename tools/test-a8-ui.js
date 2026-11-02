/* MPL-2.0: integration-oriented mock XUL tests for provider selector. */
'use strict';
const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path'), assert=require('node:assert');
const root=path.join(__dirname,'..','uxp','chrome','content');
class N {
 constructor(tag,id=''){this.tag=tag;this.id=id;this.attrs={};this.children=[];this.value='';this.checked=false;this.disabled=false;this.textContent='';this.selectedItem=null;}
 setAttribute(k,v){this.attrs[k]=String(v)}
 getAttribute(k){return this.attrs[k]||''}
 appendChild(node){this.children.push(node);return node}
 removeChild(node){this.children.splice(this.children.indexOf(node),1)}
 get firstChild(){return this.children[0]||null}
 getElementsByTagName(name){return this.children.flatMap(n=>[...(n.tag===name?[n]:[]),...n.getElementsByTagName(name)])}
}
function mockDoc(ids){const map={};ids.forEach(id=>map[id]=new N('box',id));return {getElementById:id=>map[id],createElement:tag=>new N(tag),map}}
function services(list){for(const service of ['google','bing']){const item=new N('menuitem');item.setAttribute('value',service);list.appendChild(item)};list.selectedItem=list.children[0];}
function code(doc,files,extra){const ctx=vm.createContext({document:doc,console,...extra});files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}));return ctx;}
const ids=['from','to','service','autoenabled','autosites','neversites','autolangs','neverlangs','privacy','diskcache','cachecount','dynamic','attributes','iframes','grouped','concurrency','batch','maxnodes'].map(k=>'twpuxp-option-'+k).concat('twpuxp-options-error');
const opt=mockDoc(ids);services(opt.getElementById('twpuxp-option-service'));
const vals=new Map([['from','auto'],['to','cs'],['translationService','google'],['concurrentRequests',3],['batchSize',8],['maxNodes',0],['translateDynamicContent',true],['useTwpParagraphEngine',true]]);
let saved=false;
const prefs={getCharPref:k=>vals.get(k.split('.').at(-1)),getIntPref:k=>vals.get(k.split('.').at(-1)),getBoolPref:k=>vals.get(k.split('.').at(-1)),setCharPref:(k,v)=>vals.set(k.split('.').at(-1),v),setIntPref:(k,v)=>vals.set(k.split('.').at(-1),v),setBoolPref:(k,v)=>vals.set(k.split('.').at(-1),v)};
const ctx=code(opt,['languageCatalog.js','languageMenus.js','autoRules.js','shortcutBindings.js','persistentCache.js','options.js'],{window:{close(){saved=true}},Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>prefs}},interfaces:{nsIPrefBranch:{}}}});
ctx.TWPOptions.init();
assert.equal(opt.getElementById('twpuxp-option-service').selectedItem.getAttribute('value'),'google');
opt.getElementById('twpuxp-option-service').selectedItem=opt.getElementById('twpuxp-option-service').children[1];
ctx.TWPOptions.save();
assert(saved,'options dialog must close after valid save');assert.equal(vals.get('translationService'),'bing');
const selectionIDs=['from','to','service','original','translation','direction','status','copy'].map(k=>'twpuxp-selection-'+k);
const sel=mockDoc(selectionIDs);services(sel.getElementById('twpuxp-selection-service'));
let selected=[];
const args={original:'Hello',preferredSource:'auto',source:'en',target:'cs',service:'bing',request(a,b,c,cb){selected.push([a,b,c]);cb(null,'translated with '+c)}};
const res=code(sel,['languageCatalog.js','languageMenus.js','selectionResult.js'],{window:{arguments:[args]},Components:{}});
res.TWPSelectionResult.init();
assert.equal(sel.getElementById('twpuxp-selection-service').selectedItem.getAttribute('value'),'bing');
assert.equal(selected[0][2],'bing');
assert.equal(sel.getElementById('twpuxp-selection-translation').value,'translated with bing');
sel.getElementById('twpuxp-selection-service').selectedItem=sel.getElementById('twpuxp-selection-service').children[0];
res.TWPSelectionResult.run();
assert.equal(selected.at(-1)[2],'google');
console.log('PASS a8 UI: provider prefs persisted, selection popup provider switch, backwards-compatible request callback');
