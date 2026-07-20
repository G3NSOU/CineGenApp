const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveStorageFilePath } = require('../src/services/uploadService');
const {
  resolveImageInputForOmniLocalBase64,
  resolveVolcClassicImage,
  resolveVideoProtocol,
} = require('../src/services/videoClient');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cinegen-local-ref-'));
const imageDir = path.join(root, 'images');
fs.mkdirSync(imageDir, { recursive: true });
const imageBytes = Buffer.from('cinegen-reference-image');
fs.writeFileSync(path.join(imageDir, '参考 图.jpg'), imageBytes);

after(() => fs.rmSync(root, { recursive: true, force: true }));

describe('local reference path resolution', () => {
  it('accepts local_path, /static path, and localhost URL forms', () => {
    const expected = path.join(imageDir, '参考 图.jpg');
    const inputs = [
      'images/参考 图.jpg',
      '/static/images/%E5%8F%82%E8%80%83%20%E5%9B%BE.jpg?cache=1',
      'static/images/参考 图.jpg',
      'http://localhost:5679/static/images/%E5%8F%82%E8%80%83%20%E5%9B%BE.jpg',
      expected,
    ];
    for (const input of inputs) {
      assert.equal(resolveStorageFilePath(root, input)?.filePath, expected, input);
    }
  });

  it('rejects public URLs, traversal, and absolute paths outside storage', () => {
    assert.equal(resolveStorageFilePath(root, 'https://example.com/static/ref.jpg'), null);
    assert.equal(resolveStorageFilePath(root, '../secret.txt'), null);
    assert.equal(resolveStorageFilePath(root, '/etc/passwd'), null);
    assert.equal(resolveStorageFilePath(root, '/static/../../secret.txt'), null);
  });

  it('converts every supported local form to base64 for omni fallback', () => {
    const log = { info() {}, warn() {} };
    for (const input of ['images/参考 图.jpg', '/static/images/参考 图.jpg', 'http://127.0.0.1:5679/static/images/参考%20图.jpg']) {
      const result = resolveImageInputForOmniLocalBase64(input, '', root, log, 1);
      assert.equal(result, `data:image/jpeg;base64,${imageBytes.toString('base64')}`);
    }
  });

  it('converts relative first/last frame paths without relying on files_base_url', () => {
    const log = { info() {} };
    const result = resolveVolcClassicImage('/static/images/参考 图.jpg', '', root, log, 2, 'first_frame');
    assert.equal(result, `data:image/jpeg;base64,${imageBytes.toString('base64')}`);
  });

  it('infers Agnes without referencing an undefined provider variable', () => {
    assert.equal(resolveVideoProtocol({ provider: 'agnes', base_url: 'https://gateway.example.com' }, ''), 'agnes');
  });
});
