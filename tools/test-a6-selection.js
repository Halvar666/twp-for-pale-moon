const vm=require('node:vm');const fs=require('node:fs');
const js=fs.readFileSync(require('node:path').join(__dirname,'..','uxp','chrome','content','browser.js'),'utf8');
let calls=[],dialogs=[];
const page={location:{protocol:'https:'},documentElement:{},body:{},defaultView:{getSelection(){return 'Lorem ipsum dolor sit amet.  '}}};
const prefs=new Map([['extensions.twpuxp.from','auto'],['extensions.twpuxp.to','cs']]);
const fakePrefs={getCharPref(n){if(!prefs.has(n))throw Error('unprovided '+n);return prefs.get(n)},getIntPref(n){throw Error('default')},getBoolPref(n){throw Error('default')},setCharPref(n,v){prefs.set(n,v)}};
const browser={selectedBrowser:{contentDocument:page}};
const ctx={console,WeakMap,Set,Map,Date,Array,Math,Error,Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return fakePrefs}}},interfaces:{nsIPrefBranch:{}}},gBrowser:browser,
 TWPUXPLanguage:{detect(d){return 'de'}},
 TWPGoogleProvider:{translateMany(texts,from,to,doc,key,timeout,done){calls.push({texts,from,to});done(null,texts.map(t=>'<'+to+'>'+t))}},
 TWPUXPProviders:{has(n){return n==='google'},get(){return ctx.TWPGoogleProvider}},
 window:{addEventListener(){},removeEventListener(){},alert(m){throw Error(m)},openDialog(...args){dialogs.push(args)}},
 document:{getElementById(){return null}},setTimeout,clearTimeout};
vm.createContext(ctx);require('./test-support/uxp-runtime').loadLegacyCache(ctx, require('node:path').join(__dirname,'..','uxp','chrome','content'));for(const name of ['textLayout.js','pageController.js','selectionController.js','browserChrome.js']) {
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','uxp','chrome','content',name),'utf8'),ctx,{filename:name});
}
vm.runInContext(js,ctx);
ctx.TWPUXP.translateSelectedText();
if(dialogs.length!==1||dialogs[0][3].original!=='Lorem ipsum dolor sit amet.  '||dialogs[0][3].source!=='de')throw Error('failed original selection');
let got;
dialogs[0][3].request((error,txt)=>{if(error)throw error;got=txt});
if(got!=='<cs>Lorem ipsum dolor sit amet.  '||calls.length!==1)throw Error('request failed '+got);
console.log('PASS ordinary selected text, auto language and provider invocation');
// Test much longer selections (under 20K), request must not drop chars.
page.defaultView.getSelection=()=>Array.from({length:2000},()=> 'hello').join(' ');
dialogs.length=0;calls.length=0;
ctx.TWPUXP.translateSelectedText();
let longResult;
dialogs[0][3].request((err,val)=>{if(err)throw err;longResult=val});
if(!longResult || !longResult.includes('<cs>') || longResult.length < 9500 || calls.length < 2) throw Error('long selection mishandled '+(longResult||'').length+' calls '+calls.length);
console.log('PASS long selected text, '+calls.reduce((a,c)=>a+c.texts.length,0)+' segments / '+calls.length+' batched provider calls');
