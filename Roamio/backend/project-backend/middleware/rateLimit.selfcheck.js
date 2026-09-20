const assert = require('node:assert');
const rateLimit = require('./rateLimit');

let clock = 0;
const limiter = rateLimit({ max: 2, windowMs: 1000, now: () => clock });
const call = (ip) => {
  const res = { headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json() { return this; } };
  let passed = false;
  limiter({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } }, res, () => { passed = true; });
  return { passed, res };
};

assert(call('1.1.1.1').passed);
assert(call('1.1.1.1').passed);
const blocked = call('1.1.1.1');
assert(!blocked.passed && blocked.res.code === 429 && blocked.res.headers['Retry-After'] === '1');
assert(call('2.2.2.2').passed, 'other IPs are unaffected');
clock = 1000;
assert(call('1.1.1.1').passed, 'window resets');
console.log('rateLimit: all assertions passed');
