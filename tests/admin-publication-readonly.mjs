import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const admin=readFileSync('admin.html','utf8');
const publicHtml=readFileSync('index.html','utf8');
const cloud=readFileSync('cloud-data.js','utf8');
const publicData=readFileSync('data.js','utf8');
const app=readFileSync('admin.js','utf8');
const cfg=readFileSync('cloud-config.js','utf8');
const assets=['cast-side-rail.css','cast-view-adjustments.css','cast-rail-current.css','cast-side-rail.js'];
for(const name of assets){
  const match=new RegExp(name.replace(/\./g,'\\.')+'\\?v=([0-9.]+)');
  const a=admin.match(match),p=publicHtml.match(match);
  assert.ok(a&&p,'Missing current V16 asset: '+name);
  assert.equal(a[1],p[1],'Admin and public V16 asset version mismatch for '+name);
}
assert.ok(cloud.includes('await verifyPublicVisibility(nextPublic.publicationId)'),
  'Admin publication must verify anonymous readback of exact revision');
assert.ok(cloud.indexOf("await putRow('published',nextPublic)") <
  cloud.indexOf('await verifyPublicVisibility(nextPublic.publicationId)'),
  'Verification must follow the cloud commit');
assert.ok(cloud.includes("new BroadcastChannel('cast-signal-published')"),
  'Admin should broadcast only a successfully verified publication');
assert.ok(publicData.includes("new BroadcastChannel('cast-signal-published')"),
  'Public page must listen for verified publication updates');
assert.ok(app.includes('● PUBLIC VERIFIED'), 'Admin must distinguish verified status from draft');
assert.ok(app.includes('CLOUD PUBLISH / BACKUP EXPORT'), 'Admin must clarify cloud versus GitHub publishing');

const url=cfg.match(/url:\s*'([^']+)'/)?.[1];
const key=cfg.match(/publishableKey:\s*'([^']+)'/)?.[1];
assert.ok(url?.startsWith('https://')&&url.endsWith('.supabase.co'));
assert.ok(key?.startsWith('sb_publishable_')||key?.startsWith('eyJ'),
  'Do not use a private service_role key for anonymous public verification');

// READ ONLY. No mutations and no secret output. Same endpoint and API key
// combination as the website's public data.js.
const endpoint=url+'/rest/v1/cast_documents?kind=eq.published&select=payload';
const response=await fetch(endpoint,{
  method:'GET',
  headers:{apikey:key,Accept:'application/json'},
  signal:AbortSignal.timeout(16000),
  cache:'no-store'
});
assert.equal(response.status,200,
  'Anonymous public published row is not readable (HTTP '+response.status+'). Check RLS policies.');
const rows=await response.json(),d=rows?.[0]?.payload;
assert.ok(d?.version===5&&Array.isArray(d.characters)&&Array.isArray(d.worlds)&&Array.isArray(d.tags),
  'Supabase anonymous response does not contain valid published data. Check public RLS.');
console.log('ADMIN/PUBLIC ASSET PARITY PASS — four V16 file URLs match.');
console.log('CLOUD ANONYMOUS READ PASS — published row is accessible; '+d.characters.length+
  ' characters / '+d.worlds.length+' worlds. No content was modified.');
