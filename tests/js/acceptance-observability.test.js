'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');


const PRELOAD_PATH = path.resolve(__dirname, '..', '..', 'preload.js');


function loadPetAPI(acceptanceValue) {
  const exposed = {};
  const originalValue = process.env.BLUEBERRY_ACCEPTANCE;
  const originallyPresent = Object.prototype.hasOwnProperty.call(process.env, 'BLUEBERRY_ACCEPTANCE');

  try {
    if (acceptanceValue === undefined) {
      delete process.env.BLUEBERRY_ACCEPTANCE;
    } else {
      process.env.BLUEBERRY_ACCEPTANCE = acceptanceValue;
    }

    const source = fs.readFileSync(PRELOAD_PATH, 'utf8');
    vm.runInNewContext(source, {
      process,
      require(moduleName) {
        assert.equal(moduleName, 'electron');
        return {
          contextBridge: {
            exposeInMainWorld(name, value) {
              exposed[name] = value;
            },
          },
          ipcRenderer: {
            on() {},
            send() {},
          },
        };
      },
    }, { filename: PRELOAD_PATH });
  } finally {
    if (originallyPresent) {
      process.env.BLUEBERRY_ACCEPTANCE = originalValue;
    } else {
      delete process.env.BLUEBERRY_ACCEPTANCE;
    }
  }

  return exposed.petAPI;
}


test('preload disables acceptance mode unless the flag is exactly string 1', () => {
  for (const value of [undefined, '', '0', 'true', '01', ' 1', '1 ']) {
    assert.equal(loadPetAPI(value).acceptanceMode, false, `value ${JSON.stringify(value)}`);
  }
});


test('preload enables acceptance mode for exact string 1', () => {
  assert.equal(loadPetAPI('1').acceptanceMode, true);
});
