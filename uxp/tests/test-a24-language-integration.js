/* a11 opt-in auto-translation event integration without network or Pale Moon runtime. */
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.resolve(__dirname,'../chrome/content');
let docs=[], activeDoc, calls=[], events={}, windows={}, elements={};
function createDoc(host,lang,text) {
  const node={nodeValue:text,parentNode:{}};
  const body={appendChild(el){el.parentNode=body;this.last=el;},
    removeChild(el){if(this.last===el)this.last=null;el.parentNode=null;}};
  const d={body, node,location:{protocol:'https:',hostname:host},
    documentElement:{getAttribute(k){return k==='lang'?lang:null;}},
    querySelectorAll(){return []},getElementById(id){return body.last&&body.last.id===id?body.last:null},
    createElement(){return {id:'',style:{},setAttribute(){},textContent:'',parentNode:null}}};
  docs.push(d);return d;
}
const prefs={
  'extensions.twpuxp.from':'fr', // Must NOT be used in automatic mode.
  'extensions.twpuxp.to':'cs',
  'extensions.twpuxp.translationService':'google',
  'extensions.twpuxp.autoTranslateEnabled':true,
  'extensions.twpuxp.autoTranslateSites':'example.com',
  'extensions.twpuxp.neverTranslateSites':'',
  'extensions.twpuxp.autoTranslateLanguages':'',
  'extensions.twpuxp.neverTranslateLanguages':'',
  'extensions.twpuxp.translateDynamicContent':false,
  'extensions.twpuxp.useTwpParagraphEngine':true,
  'extensions.twpuxp.toolbarInserted':true,
  'extensions.twpuxp.maxNodes':0,'extensions.twpuxp.batchSize':8,
  'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':10000,
  'extensions.twpuxp.requestDelayMs':0
};
const prefService={
  getCharPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
  getIntPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
  getBoolPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
  setCharPref(k,v){prefs[k]=v},setBoolPref(k,v){prefs[k]=v},prefHasUserValue(){return false}
};
function elem(tag){return {tag,attrs:{},children:[],id:'',
 setAttribute(k,v){this.attrs[k]=v},appendChild(c){this.children.push(c)},
 addEventListener(){},getElementsByTagName(){return []}};}
const gBrowser={selectedBrowser:{get contentDocument(){return activeDoc}},
  addEventListener(k,fn){events[k]=fn},removeEventListener(){},
  tabContainer:{addEventListener(k,fn){events[k]=fn},removeEventListener(){}}};
const ctx=vm.createContext({TWPUXPCache:{translatePieces(p,s,b,src,tgt,d,k,timeout,cb){return p.translatePieces(b,src,tgt,d,k,timeout,cb)},translateMany(p,s,b,src,tgt,d,k,timeout,cb){return p.translateMany(b,src,tgt,d,k,timeout,cb)},close(){}},Map,Set,WeakMap,Date,setTimeout,clearTimeout,console,
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return prefService}}},interfaces:{nsIPrefBranch:{}}},
  gBrowser,document:{getElementById(id){return id==='mainPopupSet'?{appendChild(){}}:null},
    getElementsByTagName(){return []},createElement:elem,documentElement:{appendChild(){}}},
  window:{addEventListener(k,fn){windows[k]=fn},removeEventListener(){},alert(){}},
  TWPUXPProviders:{has(n){return n==='google'},get(){return {
    translatePieces(batch,source,target,doc,key,timeout,done){calls.push({source,target,host:doc.location.hostname});
      done(null,batch.map(p=>p.originals.map(()=>"Přeloženo")));
    }
  }}},
  TWPUXPPageTranslator:{collect(doc){return [{nodes:[doc.node],originals:[doc.node.nodeValue]}]},
    prioritizeVisible(pieces){return pieces},apply(p,results,originals){const n=p.nodes[0];
      originals.push({node:n,original:n.nodeValue,translated:results[0]});n.nodeValue=results[0];return 1;}}
});
for(const file of ['languageCatalog.js','autoRules.js','languageDetector.js','pageAttributes.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
function pause(t){return new Promise(r=>setTimeout(r,t));}
(async()=>{
  const doc=createDoc('news.example.com','en-US','Hello world');activeDoc=doc;
  windows.load();
  await pause(550);
  assert.strictEqual(doc.node.nodeValue,'Přeloženo');
  assert.strictEqual(calls.length,1);
  assert.strictEqual(calls[0].source,'en','auto uses detected page language not manual fr preference');
  assert.strictEqual(prefs['extensions.twpuxp.from'],'fr','automatic translation must not persist a new manual source pref');
  // Tab selection must not retranslate an already handled document.
  events.TabSelect();await pause(500);assert.strictEqual(calls.length,1);
  const denied=createDoc('blocked.example.com','en','Not changed');activeDoc=denied;
  prefs['extensions.twpuxp.neverTranslateSites']='blocked.example.com';
  events.TabSelect();await pause(500);
  assert.strictEqual(denied.node.nodeValue,'Not changed');
  assert.strictEqual(calls.length,1);
  // Allow-by-language with a different domain and a declared language.
  prefs['extensions.twpuxp.autoTranslateSites']='';
  prefs['extensions.twpuxp.autoTranslateLanguages']='de';
  const german=createDoc('different.org','de','Hallo');activeDoc=german;
  events['DOMContentLoaded']({target:german});await pause(500);
  assert.strictEqual(german.node.nodeValue,'Přeloženo');
  assert.strictEqual(calls[1].source,'de');
  const unknown=createDoc('unknown.org','','Unknown');activeDoc=unknown;
  events['DOMContentLoaded']({target:unknown});await pause(500);
  assert.strictEqual(unknown.node.nodeValue,'Unknown');
  // A24: language exclusion must override a specific positive domain rule.
  prefs['extensions.twpuxp.autoTranslateSites']='news.example.com';
  prefs['extensions.twpuxp.neverTranslateLanguages']='en';
  prefs['extensions.twpuxp.neverTranslateSites']='';
  prefs['extensions.twpuxp.autoTranslateLanguages']='en';
  const blockedEnglish=createDoc('news.example.com','en','Do not translate');activeDoc=blockedEnglish;
  events['DOMContentLoaded']({target:blockedEnglish});await pause(500);
  assert.strictEqual(blockedEnglish.node.nodeValue,'Do not translate');
  assert.strictEqual(calls.length,2,'excluded language still launched a translation');
  // The restriction is for automatic translation only; manual action must work.
  ctx.TWPUXP.translateCurrentPage('auto','cs');await pause(250);
  assert.strictEqual(blockedEnglish.node.nodeValue,'Přeloženo');
  assert.strictEqual(calls.length,3,'manual translation blocked by automatic policy');
  prefs['extensions.twpuxp.autoTranslateSites']='';
  prefs['extensions.twpuxp.autoTranslateLanguages']='de';
  const german2=createDoc('new.example.org','de','German again');activeDoc=german2;
  events['DOMContentLoaded']({target:german2});await pause(500);
  assert.strictEqual(german2.node.nodeValue,'Přeloženo','unexcluded allowed language stopped working');
  console.log('PASS a24: browser skips explicitly excluded language on allowed site, manual action works, other languages remain eligible');
  process.exit(0); // All assertions complete; browser mock has recurring UI timer.
})().catch(e=>{console.error(e);process.exit(1)});
