import assert from 'node:assert/strict';
import { createMapTooltip } from './mapTooltip.js';

const payload = '<img src=x onerror="globalThis.syntheticXss=true">';
const documentApi = {
  createElement(tagName) {
    return {
      tagName,
      textContent: '',
      set innerHTML(_value) { throw new Error('Trip data must never enter an HTML sink'); },
    };
  },
};
const node = createMapTooltip({ dayNumber: 1 }, { startTime: '09:00', landmark: { name: payload } }, documentApi);
assert.equal(node.tagName, 'span');
assert.equal(typeof node, 'object');
assert.equal(node.textContent, `Day 1 · 09:00 · ${payload}`);
console.log('map tooltip security selfcheck: all assertions passed');
