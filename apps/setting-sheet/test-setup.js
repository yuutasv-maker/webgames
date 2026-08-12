import { JSDOM } from 'jsdom';

import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
const dom = new JSDOM(html);

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

// モック: getBoundingClientRect (JSDOMはこれを正しく計算できないため)
global.window.Element.prototype.getBoundingClientRect = function() {
  if (this.id === 'stage') {
    return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
  } else if (this.id === 'trash-zone') {
    return { left: 0, top: 600, width: 800, height: 100, right: 800, bottom: 700 };
  }
  return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
};

// モック: localStorage
let store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value.toString(); },
  clear: () => { store = {}; }
};

export function clearLocalStorageMock() {
  store = {};
}
