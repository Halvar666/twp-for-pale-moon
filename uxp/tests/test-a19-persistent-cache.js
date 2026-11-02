/* MPL-2.0. Opt-in disk cache: SQLite mock + provider-independent semantics. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const content = path.resolve(__dirname, '../chrome/content/persistentCache.js');
const state = {enabled:false, private:false, fileExists:false, providerCalls:0};
const dbRows = new Map();
const prefs = {getBoolPref(k){assert.equal(k,'extensions.twpuxp.persistentCacheEnabled');return state.enabled;}};
const db = {
  executeSimpleSQL(s){assert.match(s,/CREATE (TABLE|INDEX)/);},
  close(){},
  createStatement(sql){
    const stmt={params:{},row:{},executeStep(){
      if(sql.startsWith('SELECT translated')) {
        if(!dbRows.has(this.params.key))return false;
        this.row.translated=dbRows.get(this.params.key).value;return true;
      }
      if(sql.startsWith('SELECT COUNT(')){this.row.total=dbRows.size;return true;}
      throw Error('Unexpected SELECT: '+sql);
    },execute(){
      if(sql.startsWith('INSERT OR REPLACE')){
        dbRows.set(this.params.key,{value:this.params.result,time:this.params.date});return;
      }
      if(sql.startsWith('DELETE FROM translations WHERE')){
        const order=[...dbRows.entries()].sort((a,b)=>b[1].time-a[1].time);
        for(const [key] of order.slice(2500))dbRows.delete(key);return;
      }
      if(sql.startsWith('DELETE FROM translations')){dbRows.clear();return;}
      throw Error('Unexpected SQL: '+sql);
    },finalize(){}};
    return stmt;
  }
};
const classes={
  '@mozilla.org/preferences-service;1':{getService(){return prefs}},
  '@mozilla.org/file/directory_service;1':{getService(){return {get(){return {append(){},exists(){return state.fileExists;}}}}}},
  '@mozilla.org/storage/service;1':{getService(){return {openDatabase(){state.fileExists=true;return db;}}}}
};
const ctx=vm.createContext({console,Map,JSON,Date,setTimeout,clearTimeout,window:{},
 Components:{classes,interfaces:{nsIPrefBranch:{},nsIProperties:{},nsIFile:{},mozIStorageService:{}},
 utils:{import(url, out){assert.match(url,/PrivateBrowsingUtils/);out.PrivateBrowsingUtils={isWindowPrivate(){return state.private}};},reportError:()=>{}}}});
vm.runInContext(fs.readFileSync(content,'utf8'),ctx,{filename:content});
const c=ctx.TWPUXPCache;
const doc={defaultView:{}};
const provider={
 translatePieces(pieces,from,to,_doc,_key,_timeout,done){state.providerCalls++;done(null,pieces.map(piece=>piece.originals.map(v=>'tr:'+v)));},
 translateMany(texts,from,to,_doc,_key,_timeout,done){state.providerCalls++;done(null,texts.map(v=>'tr:'+v));}
};
function pieces(service,originals,providerArg=provider) {
 return new Promise((resolve,reject)=>c.translatePieces(providerArg,service,
  originals.map(a=>({nodes:a.map(()=>({})),originals:a})), 'en','cs',doc,'',20000,(e,output)=>e?reject(e):resolve(output)));
}
function many(service,texts) {
 return new Promise((resolve,reject)=>c.translateMany(provider,service,texts,'en','cs',doc,'',20000,
   (e,output)=>e?reject(e):resolve(output)));
}
(async()=>{
 assert.equal(c.count(),0,'no database should be created by counter alone');
 await pieces('google',[['hello','world']]);
 assert.equal(dbRows.size,0,'cache off by default');
 state.enabled=true;
 assert.equal(c.count(),0);
 await pieces('google',[['hello','world'],['another']]);
 assert.equal(c.count(),2);
 const prior=state.providerCalls;
 assert.deepEqual(JSON.parse(JSON.stringify(await pieces('google',[['hello','world'],['another']]))),
  [['tr:hello','tr:world'],['tr:another']]);
 assert.equal(state.providerCalls,prior,'disk hit must bypass network');
 await pieces('bing',[['hello','world']]);
 assert.equal(c.count(),3,'provider-specific entries');
 await many('google',['hello','another']);
 assert.equal(c.count(),5,'text and page modes have separate cache keys');
 const priorMany=state.providerCalls;
 await many('google',['hello','another']);
 assert.equal(state.providerCalls,priorMany,'cached selection should skip request');
 state.private=true;
 await pieces('google',[['hello','world']]);
 assert.equal(state.providerCalls,priorMany+1,'private window never reads disk');
 await pieces('google',[['private only']]);
 assert.equal(c.count(),5,'private window never writes disk');
 state.private=false;
 const incomplete={translatePieces(batch,src,tgt,d,key,timeout,cb){
  cb(null,Object.assign(batch.map(p=>p.originals.map(()=>'partial')),{failedSegments:1}));}};
 await pieces('bing',[['not safe']],incomplete);
 assert.equal(c.count(),5,'incomplete translations must not be saved');
 state.enabled=false;
 await pieces('google',[['hello','world']]);
 assert.equal(state.providerCalls,priorMany+3,'disabling cache prevents reading disk');
 assert.equal(c.count(),5,'disabling cache keeps previous records until cleared');
 assert.equal(c.clear(),true);
 assert.equal(c.count(),0);
 c.close();
 console.log('PASS: opt-in only, provider/mode isolation, disk hits, private mode, incomplete response, clear.');
})().catch(e=>{console.error(e);process.exit(1)});
