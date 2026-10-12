import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const middleware = fs.readFileSync(path.join(root, 'functions', 'ask', 'api', '_middleware.js'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'functions', 'ask', 'api', 'chat.js'), 'utf8');

assert.match(middleware, /MAX_BODY_BYTES\s*=\s*96\s*\*\s*1024/);
assert.match(middleware, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
assert.match(middleware, /contentLength > MAX_BODY_BYTES/);
assert.match(middleware, /application\/json/);
assert.match(middleware, /allow: 'POST, OPTIONS'/);

// Chat itself must continue to cap the user-controlled prompt/history before
// anything reaches an external model provider.
assert.match(chat, /MAX_MESSAGE_LENGTH=500/);
assert.match(chat, /MAX_HISTORY_MESSAGES=10/);
assert.match(chat, /slice\(0,MAX_MESSAGE_LENGTH\)/);
assert.match(chat, /cleanHistory\(body\.history\)/);

// Trailing slash must not dodge the per-route rate limit; null/array bodies and
// null tool arguments must be rejected cleanly instead of throwing.
assert.match(middleware, /pathname\.split\('\/'\)\.filter\(Boolean\)\.pop\(\)/);
assert.match(chat, /Body must be a JSON object/);
assert.match(chat, /args must be an object/);
// `String({toString: 1})` throws, which escaped as a 500 from a public endpoint. Only real strings are a message.
assert.match(chat, /typeof body\.message==='string'/, 'the Ask message must be accepted only when it is a string');
assert.doesNotMatch(chat, /String\(body\.message/, 'String() on a JSON field throws for {"toString":1}');

// Milgard is one of the two window lines Clearview installs (/window-features, /replacement, the Cascade vs
// Milgard guide the assistant retrieves from, quote line items). Listing it as a competitor made the assistant
// rewrite, then refuse ("not available"), any answer that named it. Real competitors stay blocked.
const competitor = chat.match(/const COMPETITOR=(\/.*?\/i);/);
assert.ok(competitor, 'chat.js must define COMPETITOR');
const competitorRe = new Function(`return ${competitor[1]}`)();
for (const name of ['Andersen', 'Pella', 'Marvin', 'Jeld-Wen', 'Simonton', 'Renewal by Andersen']) assert.ok(competitorRe.test(`${name} windows`), `${name} stays a blocked competitor`);
for (const own of ['Milgard', 'milgard', 'Cascade', 'Cascade vs Milgard']) assert.ok(!competitorRe.test(`We install ${own} windows`), `${own} is a Clearview window line, not a competitor`);

console.log('Ask API security audit: PASS');
