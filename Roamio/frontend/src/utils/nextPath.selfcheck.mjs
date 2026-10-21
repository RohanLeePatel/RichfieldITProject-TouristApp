// node src/utils/nextPath.selfcheck.mjs
import assert from "node:assert/strict";

import { nextPath } from "./nextPath.js";

assert.equal(nextPath("?next=/invite/abc"), "/invite/abc");
assert.equal(nextPath(""), "/dashboard");
assert.equal(nextPath("?next=//evil.com"), "/dashboard");
assert.equal(nextPath("?next=/%5Cevil.com"), "/dashboard"); // "/\evil.com" - browsers read /\ as //
assert.equal(nextPath("?next=https://evil.com"), "/dashboard");
console.log("nextPath selfcheck: all assertions passed");
