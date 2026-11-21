import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const filenames = ['cast-side-rail.css', 'cast-view-adjustments.css', 'cast-rail-current.css'];
const original = execFileSync('git', ['show', 'origin/main:cast-side-rail.css'], {
  encoding: 'utf8', maxBuffer: 2_000_000
});
const modules = filenames.map(file => readFileSync(file, 'utf8'));
const assembled = modules.join('');
const html = readFileSync('index.html', 'utf8');

assert.equal(assembled, original, 'Module CSS concatenation must match original byte-for-byte');
assert.equal(modules.length, 3);
assert.ok(modules.every(x => x.length > 0), 'Each extracted CSS file must be nonempty');

let prev = -1;
for (const name of filenames) {
  const occurrences = [...html.matchAll(new RegExp('<link[^>]+href="' + name.replaceAll('.','\\.') + '\\?v=[^"]+"', 'g'))];
  assert.equal(occurrences.length, 1, 'Expected one ordered stylesheet link: ' + name);
  assert.ok(occurrences[0].index > prev, 'Incorrect stylesheet cascade ordering: ' + name);
  prev = occurrences[0].index;
}
const oldSingleLink = /href="cast-side-rail\.css\?v=15\.6\.0"/;
assert.ok(!oldSingleLink.test(html), 'Legacy stale-cache CSS version remains');
assert.ok(html.includes('cast-side-rail.js?v=15.6.0'), 'Production JS must remain unchanged');
const counters = modules.map((s, i) => ({
  file: filenames[i], bytes: Buffer.byteLength(s), lines: s.split('\n').length
}));
console.log('CSS MODULE INTEGRITY PASS: exact concatenation, stable link order & JS');
console.log(JSON.stringify(counters, null, 2));
