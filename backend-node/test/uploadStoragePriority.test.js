const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadToPreferredStorage } = require('../src/services/uploadService');

const silentLog = { info() {}, warn() {} };

test('configured TOS wins without calling the third-party image host', async () => {
  let fallbackCalls = 0;
  const result = await uploadToPreferredStorage(Buffer.from('image'), 'image/png', silentLog, 'ref-1', {
    tosUpload: async () => ({
      url: 'https://tos.example/ref-1.png',
      bucket: 'cinegen-assets',
      key: 'cinegen/references/ref-1.png',
    }),
    fallbackUpload: async () => { fallbackCalls += 1; return 'https://fallback.example/ref-1.png'; },
  });

  assert.equal(result, 'https://tos.example/ref-1.png');
  assert.equal(fallbackCalls, 0);
});

test('TOS failure falls back to the existing third-party image host', async () => {
  let fallbackCalls = 0;
  const result = await uploadToPreferredStorage(Buffer.from('image'), 'image/jpeg', silentLog, 'ref-2', {
    tosUpload: async () => { throw new Error('simulated TOS outage'); },
    fallbackUpload: async (_buffer, mimeType, _log, tag) => {
      fallbackCalls += 1;
      assert.equal(mimeType, 'image/jpeg');
      assert.equal(tag, 'ref-2');
      return 'https://fallback.example/ref-2.jpg';
    },
  });

  assert.equal(result, 'https://fallback.example/ref-2.jpg');
  assert.equal(fallbackCalls, 1);
});
