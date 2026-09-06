const fs = require('fs');

const tests = [];

global.describe = (name, fn) => {
  tests.push({ type: 'suite', name });
  fn();
};
global.beforeEach = (fn) => tests.push({ type: 'beforeEach', fn });
global.afterEach = (fn) => tests.push({ type: 'afterEach', fn });
global.it = (name, fn) => tests.push({ type: 'it', name, fn });

global.expect = (actual) => ({
  toBe: (expected) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); },
  toHaveBeenCalledTimes: (expected) => {
    const calls = actual.mock.calls.length;
    if (calls !== expected) throw new Error(`Expected to be called ${expected} times, got ${calls}`);
  },
  toMatch: (expected) => {
    if (expected instanceof RegExp) {
      if (!expected.test(actual)) throw new Error(`Expected ${actual} to match ${expected}`);
    } else {
      if (!actual.includes(expected)) throw new Error(`Expected ${actual} to include ${expected}`);
    }
  },
  toThrow: (msg) => {
    let threw = false;
    try { actual(); } catch (e) {
      threw = true;
      if (msg && !e.message.includes(msg)) throw new Error(`Expected error message to include ${msg}, got ${e.message}`);
    }
    if (!threw) throw new Error('Expected function to throw');
  },
  not: {
    toThrow: () => {
      try { actual(); } catch (e) { throw new Error(`Expected function not to throw, but it threw ${e.message}`); }
    }
  },
  rejects: {
    toThrow: async (msg) => {
      let threw = false;
      try { await actual; } catch (e) {
        threw = true;
        if (msg && !e.message.includes(msg)) throw new Error(`Expected error message to include ${msg}, got ${e.message}`);
      }
      if (!threw) throw new Error('Expected function to throw');
    }
  }
});
global.jest = {
  fn: (impl) => {
    const mockFn = (...args) => {
      mockFn.mock.calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    mockFn.mock = { calls: [] };
    return mockFn;
  }
};

require('./assets/js/logic.test.js');

(async () => {
  let currentBefore = [];
  let currentAfter = [];
  let hasFailure = false;
  
  for (const t of tests) {
    if (t.type === 'suite') {
      console.log('Suite:', t.name);
      currentBefore = [];
      currentAfter = [];
    } else if (t.type === 'beforeEach') {
      currentBefore.push(t.fn);
    } else if (t.type === 'afterEach') {
      currentAfter.push(t.fn);
    } else if (t.type === 'it') {
      try {
        for (const h of currentBefore) await h();
        await t.fn();
        for (const h of currentAfter) await h();
        console.log('  PASS:', t.name);
      } catch (e) {
        console.error('  FAIL:', t.name, e);
        hasFailure = true;
      }
    }
  }
  
  if (hasFailure) {
    process.exit(1);
  }
})();
