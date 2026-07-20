const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTosConfig,
  publicTosConfig,
  createClient,
  testTosConnection,
  uploadBufferToTos,
} = require('../src/services/tosStorageService');
const { tosErrorMessage } = require('../src/routes/settings');

test('TOS client keeps HTTPS and ignores incompatible HTTP proxy environment variables', () => {
  const client = createClient({
    access_key_id: 'AK',
    secret_access_key: 'SK',
    endpoint: 'tos-cn-beijing.volces.com',
    region: 'cn-beijing',
  }, { maxRetryCount: 0 });
  assert.equal(client.opts.secure, true);
  assert.equal(client.opts.maxRetryCount, 0);
  assert.equal(client.axiosInst.defaults.proxy, false);
});

test('TOS error EC 0002-00000020 explains that the IAM AccessKey does not exist', () => {
  const message = tosErrorMessage({
    statusCode: 403,
    ec: '0002-00000020',
    requestId: 'request-safe-id',
    message: '',
  });
  assert.match(message, /AccessKey ID 不存在/);
  assert.match(message, /不要填写方舟 API Key/);
  assert.match(message, /request-safe-id/);
});

test('TOS configuration preserves stored secrets when the edit form leaves them blank', () => {
  const result = normalizeTosConfig({
    enabled: true,
    bucket: 'cinegen-assets',
    secret_access_key: '',
  }, {
    access_key_id: 'TEST_ACCESS_KEY',
    secret_access_key: 'test-stored-secret',
    endpoint: 'tos-cn-beijing.volces.com',
    region: 'cn-beijing',
  });
  assert.equal(result.secret_access_key, 'test-stored-secret');
  assert.equal(result.access_key_id, 'TEST_ACCESS_KEY');
  assert.equal(result.bucket, 'cinegen-assets');
});

test('TOS public settings redact credentials', () => {
  const savedAk = process.env.TOS_ACCESS_KEY_ID;
  const savedSk = process.env.TOS_SECRET_ACCESS_KEY;
  const savedSkAlias = process.env.TOS_SECRET_KEY;
  delete process.env.TOS_ACCESS_KEY_ID;
  delete process.env.TOS_SECRET_ACCESS_KEY;
  delete process.env.TOS_SECRET_KEY;
  const result = publicTosConfig({
    tos_storage: {
      enabled: true,
      access_key_id: 'TEST_ACCESS_KEY',
      secret_access_key: 'test-never-return-this',
      endpoint: 'tos-cn-beijing.volces.com',
      region: 'cn-beijing',
      bucket: 'cinegen-assets',
    },
  });
  if (savedAk !== undefined) process.env.TOS_ACCESS_KEY_ID = savedAk;
  if (savedSk !== undefined) process.env.TOS_SECRET_ACCESS_KEY = savedSk;
  if (savedSkAlias !== undefined) process.env.TOS_SECRET_KEY = savedSkAlias;
  assert.equal(result.ready, true);
  assert.equal(result.has_secret_access_key, true);
  assert.equal('access_key_id' in result, false);
  assert.equal('secret_access_key' in result, false);
  assert.equal('security_token' in result, false);
  assert.doesNotMatch(JSON.stringify(result), /never-return-this/);
});

test('TOS upload stores the object and returns a signed URL for a private bucket', async () => {
  const calls = [];
  let clientOptions = null;
  const fakeClient = {
    async putObject(input) { calls.push(input); return { requestId: 'put-request' }; },
    getPreSignedUrl(input) { calls.push(input); return 'https://signed.example/object?X-Tos-Signature=test'; },
  };
  const result = await uploadBufferToTos(Buffer.from('image'), 'image/png', 'slot-1', {
    config: {
      enabled: true,
      access_key_id: 'AK',
      secret_access_key: 'SK',
      endpoint: 'tos-cn-beijing.volces.com',
      region: 'cn-beijing',
      bucket: 'cinegen-assets',
      prefix: 'cinegen/references',
    },
    clientFactory: (_config, options) => { clientOptions = options; return fakeClient; },
  });
  assert.match(result.key, /^cinegen\/references\/\d{4}\/\d{2}\/slot-1-/);
  assert.equal(result.url, 'https://signed.example/object?X-Tos-Signature=test');
  assert.equal(calls[0].bucket, 'cinegen-assets');
  assert.equal(calls[0].contentType, 'image/png');
  assert.equal(calls[1].method, 'GET');
  assert.deepEqual(clientOptions, {
    maxRetryCount: 0,
    requestTimeout: 20000,
    connectionTimeout: 5000,
  });
});

test('TOS connection test uses HeadBucket without creating an object', async () => {
  let checked = '';
  let retryCount = null;
  let requestTimeout = null;
  const result = await testTosConnection({
    enabled: true,
    access_key_id: 'AK',
    secret_access_key: 'SK',
    endpoint: 'tos-cn-beijing.volces.com',
    region: 'cn-beijing',
    bucket: 'cinegen-assets',
  }, (_config, options) => {
    retryCount = options.maxRetryCount;
    requestTimeout = options.requestTimeout;
    return ({
    async headBucket(bucket) { checked = bucket; return { requestId: 'head-request' }; },
    });
  });
  assert.equal(checked, 'cinegen-assets');
  assert.equal(retryCount, 0);
  assert.equal(requestTimeout, 12000);
  assert.equal(result.request_id, 'head-request');
});
