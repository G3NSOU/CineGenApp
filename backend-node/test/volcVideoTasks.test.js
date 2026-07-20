const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildQueryUrl,
  buildVideoUrl,
  cancelVolcengineVideoTask,
  listVolcengineVideoTasks,
} = require('../src/services/videoClient');
const { testConnection } = require('../src/services/aiConfigService');

const planConfig = {
  provider: 'volces',
  base_url: 'https://ark.cn-beijing.volces.com/api/plan/v3',
  api_key: 'test-key',
  endpoint: '/contents/generations/tasks',
  query_endpoint: '/contents/generations/tasks/{id}',
  settings: JSON.stringify({
    task_list_endpoint: '/contents/generations/tasks',
    task_delete_endpoint: '/contents/generations/tasks/{id}',
  }),
};

describe('Volcengine video endpoint resolution', () => {
  it('preserves a Plan base URL and appends each relative endpoint once', () => {
    assert.equal(
      buildVideoUrl(planConfig),
      'https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks'
    );
    assert.equal(
      buildQueryUrl(planConfig, 'task / 1'),
      'https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks/task%20%2F%201'
    );
  });

  it('executes an absolute endpoint exactly without prefixing Base URL', () => {
    const config = {
      ...planConfig,
      endpoint: 'https://custom-plan.example.test/special/create',
      query_endpoint: 'https://custom-plan.example.test/special/{id}',
    };
    assert.equal(buildVideoUrl(config), 'https://custom-plan.example.test/special/create');
    assert.equal(buildQueryUrl(config, 'abc'), 'https://custom-plan.example.test/special/abc');
  });

  it('does not rewrite a standard API base URL', () => {
    const config = { ...planConfig, base_url: 'https://ark.cn-beijing.volces.com/api/v3/' };
    assert.equal(
      buildVideoUrl(config),
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
    );
  });
});

describe('Volcengine official video task lifecycle', () => {
  it('tests connectivity through the configured read-only list endpoint', async () => {
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    try {
      await testConnection({
        base_url: planConfig.base_url,
        api_key: planConfig.api_key,
        model: ['doubao-seedance-2-0-fast-260128'],
        provider: planConfig.provider,
        service_type: 'video',
        settings: JSON.stringify({ task_list_endpoint: '/custom/tasks' }),
      });
      const url = new URL(request.url);
      assert.equal(request.options.method, 'GET');
      assert.equal(url.pathname, '/api/plan/v3/custom/tasks');
      assert.equal(url.searchParams.get('page_num'), '1');
      assert.equal(url.searchParams.get('page_size'), '1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses the configured task list endpoint and filters', async () => {
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ items: [{ id: 'task-1', status: 'queued' }], total: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    try {
      const result = await listVolcengineVideoTasks(planConfig, {
        page_num: 2,
        page_size: 30,
        status: 'queued',
        model: 'doubao-seedance-2-0-mini-260615',
      });
      assert.equal(request.options.method, 'GET');
      assert.equal(request.options.headers.Authorization, 'Bearer test-key');
      const url = new URL(request.url);
      assert.equal(url.pathname, '/api/plan/v3/contents/generations/tasks');
      assert.equal(url.searchParams.get('page_num'), '2');
      assert.equal(url.searchParams.get('page_size'), '30');
      assert.equal(url.searchParams.get('filter.status'), 'queued');
      assert.equal(url.searchParams.get('filter.model'), 'doubao-seedance-2-0-mini-260615');
      assert.equal(result.total, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses the configured DELETE task resource without rewriting Plan URL', async () => {
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, options) => {
      request = { url: String(url), options };
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      const result = await cancelVolcengineVideoTask(planConfig, 'task / 1');
      assert.equal(request.options.method, 'DELETE');
      assert.equal(request.options.headers.Authorization, 'Bearer test-key');
      assert.equal(new URL(request.url).pathname, '/api/plan/v3/contents/generations/tasks/task%20%2F%201');
      assert.equal(result.ok, true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
