import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('cloud-data.js','utf8');
const baseDoc={
 version:5,site:{newDays:10},tags:[],worlds:[{id:'world1',title:'Test World',published:true}],
 characters:[{id:'char1',name:'Original',published:true,artwork:'https://example.test/a.webp',icon:'https://example.test/b.webp',gallery:[]}]
};
function clone(o){return JSON.parse(JSON.stringify(o))}
async function scenario(stalePublic=false){
 const db={draft:clone(baseDoc),published:clone(baseDoc)};
 const broadcast=[], httpReads=[];
 const elems=Object.fromEntries(['cloudLogin','cloudLoginForm','cloudEmail','cloudPassword','cloudLoginButton','cloudLoginStatus']
   .map(id=>[id,{hidden:false,textContent:'',addEventListener(){}}]));
 const client={
   from(name){
     assert.equal(name,'cast_documents');
     return {
       select(){return {eq(field,kind){assert.equal(field,'kind');return {
         async maybeSingle(){return {data:db[kind]?{payload:clone(db[kind])}:null,error:null}}
       }}}},
       async upsert(row){db[row.kind]=clone(row.payload);return {error:null}}
     };
   },
   auth:{async getUser(){return {data:{user:{id:'owner'}},error:null}}},
   storage:{from(){throw Error('No upload expected in this test')}}
 };
 const window={
   CAST_CONFIG:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test_public_only'},
   supabase:{createClient(){return client}},
   BroadcastChannel:class MockChannel{
     constructor(name){assert.equal(name,'cast-signal-published')}
     postMessage(data){broadcast.push(data)}
     close(){}
   }
 };
 const document={
   getElementById(id){return elems[id]??null},
   body:{classList:{remove(){}}}
 };
 const mockFetch=async (url,opts={})=>{
   httpReads.push({url:String(url),headers:opts.headers});
   assert.ok(String(url).endsWith('/rest/v1/cast_documents?kind=eq.published&select=payload'));
   assert.equal(opts.headers.apikey,window.CAST_CONFIG.publishableKey);
   assert.ok(!('Authorization' in opts.headers),'No signed-in auth may be used for public verification');
   return {ok:true,status:200,async json(){return [{payload:stalePublic?clone(baseDoc):clone(db.published)}]}};
 };
 const sandbox={window,document,fetch:mockFetch,console,setTimeout,clearTimeout,
   AbortController,crypto:{randomUUID(){return 'rev-'+Math.random().toString(36).slice(2)}},
   BroadcastChannel:window.BroadcastChannel};
 vm.runInNewContext(source,sandbox,{filename:'cloud-data.js'});
 await window.CAST_DATA_READY;
 assert.ok(window.CAST_DATA,'Login and initialization should succeed');
 const api=window.CAST_DATA;
 api.getDraft().characters[0].name='Updated';
 assert.equal(await api.saveDraft(),true);
 const result=await api.publish();
 assert.equal(db.published.characters[0].name,'Updated','Backend row must receive new data');
 if(stalePublic){
   assert.equal(result,false,'Should not report verified success when public read sees stale content');
   assert.match(api.getLastError(),/公開サイト側の確認に失敗/);
   assert.equal(broadcast.length,0,'Never broadcast unverified publication');
 }else{
   assert.equal(result,true,'Should report verified publish only after anonymous readback');
   assert.equal(httpReads.length,1,'Expected anonymous GET after writing');
   assert.equal(broadcast.length,1,'Expected verified cross-tab notification');
   assert.equal(db.published.publicationId,broadcast[0].revision);
 }
 return result;
}
await scenario(false);
await scenario(true);
console.log('CLOUD PUBLISH BEHAVIOR PASS — verified readback succeeds; stale public read fails safely.');
