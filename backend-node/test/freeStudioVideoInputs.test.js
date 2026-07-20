const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { collectAudioReferences, normalizeGenerationInputs, normalizeOmniReferencePrompt } = require('../src/routes/videos');
const { buildVolcengineOmniRequestBody, isSeedance2FamilyModel, normalizeVolcengineDuration, resolveRuntimeVideoProtocol } = require('../src/services/videoClient');

describe('free studio video generation inputs', () => {
  it('keeps only the main image in image-to-video mode', () => {
    const result = normalizeGenerationInputs({
      generation_mode: 'image_to_video',
      image_url: '/static/main.png',
      first_frame_url: '/static/first.png',
      reference_image_urls: ['/static/ref.png'],
    });
    assert.equal(result.imageUrl, '/static/main.png');
    assert.equal(result.firstFrameUrl, null);
    assert.deepEqual(result.referenceImages, []);
  });

  it('limits omni mode to nine ordered references and clears keyframes', () => {
    const refs = Array.from({ length: 11 }, (_, index) => `/static/${index + 1}.png`);
    const result = normalizeGenerationInputs({
      generation_mode: 'omni_reference',
      image_url: '/static/main.png',
      first_frame_url: '/static/first.png',
      last_frame_url: '/static/last.png',
      reference_image_urls: refs,
    });
    assert.equal(result.imageUrl, null);
    assert.equal(result.firstFrameUrl, null);
    assert.equal(result.lastFrameUrl, null);
    assert.deepEqual(result.referenceImages, refs.slice(0, 9));
  });

  it('rejects a blank omni slot instead of shifting later @ image numbers', () => {
    const result = normalizeGenerationInputs({
      generation_mode: 'omni_reference',
      reference_image_urls: ['first.png', '', 'third.png'],
    });
    assert.match(result.error, /参考图片2.*序号错位/);
  });

  it('requires both keyframes and clears omni references', () => {
    const invalid = normalizeGenerationInputs({ generation_mode: 'first_last_frame', first_frame_url: 'first.png' });
    assert.match(invalid.error, /首帧和尾帧/);

    const valid = normalizeGenerationInputs({
      generation_mode: 'first_last_frame',
      first_frame_url: 'first.png',
      last_frame_url: 'last.png',
      reference_image_urls: ['ref.png'],
    });
    assert.deepEqual(valid.referenceImages, []);
    assert.equal(valid.firstFrameUrl, 'first.png');
    assert.equal(valid.lastFrameUrl, 'last.png');
  });

  it('treats Seedance 2.0 mini as the same 4-15 second family', () => {
    const model = 'doubao-seedance-2-0-mini-260615';
    assert.equal(isSeedance2FamilyModel(model), true);
    assert.equal(normalizeVolcengineDuration(model, 2), 4);
    assert.equal(normalizeVolcengineDuration(model, 20), 15);
  });

  it('keeps @ image slots stable when three references are mentioned out of order', () => {
    const result = normalizeOmniReferencePrompt('男孩@图片1在广场@图片3上骑车@图片2。', 3);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.numbers, [1, 3, 2]);
    assert.equal(result.prompt, '男孩@图片1 在广场@图片3 上骑车@图片2。');
  });

  it('rejects missing and out-of-range omni image references', () => {
    assert.match(normalizeOmniReferencePrompt('@图片1 和 @图片4', 3).error, /@图片4/);
    assert.match(normalizeOmniReferencePrompt('@图片1', 3).error, /@图片2.*@图片3/);
  });

  it('keeps character voices paired with their image and standalone audio in one list', () => {
    const result = collectAudioReferences([
      { type: 'character', order: 1, voice: { url: 'https://tos/voice.wav', duration: 2.5, muted: false } },
      { type: 'character', order: 2, voice: { url: 'https://tos/muted.wav', duration: 3, muted: true } },
      { type: 'audio', url: 'https://tos/music.mp3', duration: 4 },
    ]);
    assert.deepEqual(result, [
      { type: 'voice', url: 'https://tos/voice.wav', duration: 2.5, after_image_order: 1 },
      { type: 'audio', url: 'https://tos/music.mp3', duration: 4 },
    ]);
  });

  it('uses the omni request body for Seedance 2.0 references without rewriting saved config', () => {
    assert.equal(resolveRuntimeVideoProtocol('volcengine', 'doubao-seedance-2-0-mini-260615', {
      reference_urls: ['https://tos/ref.png'], audio_references: [],
    }), 'volcengine_omni');
    assert.equal(resolveRuntimeVideoProtocol('volcengine', 'doubao-seedance-2-0-mini-260615', {
      reference_urls: [], audio_references: [],
    }), 'volcengine');
    assert.equal(resolveRuntimeVideoProtocol('custom-protocol', 'doubao-seedance-2-0-mini-260615', {
      reference_urls: ['https://tos/ref.png'],
    }), 'custom-protocol');
  });

  it('builds the official Seedance 2.0 multimodal content format and voice relation', () => {
    const body = buildVolcengineOmniRequestBody({
      model: 'doubao-seedance-2-0-mini-260615',
      prompt: '男孩@图片1在广场@图片2上骑着自行车@图片3。',
      imageUrls: ['https://tos/boy.png', 'https://tos/plaza.png', 'https://tos/bike.png'],
      audioReferences: [{ url: 'https://tos/boy.wav', after_image_order: 1, original_index: 0 }],
      ratio: '16:9', duration: 15, resolution: '720p', watermark: false,
    });
    assert.deepEqual(body.content.slice(1, 4).map((item) => [item.type, item.role]), [
      ['image_url', 'reference_image'], ['image_url', 'reference_image'], ['image_url', 'reference_image'],
    ]);
    assert.deepEqual(body.content[4], {
      type: 'audio_url', audio_url: { url: 'https://tos/boy.wav' }, role: 'reference_audio',
    });
    assert.equal(body.content[0].text, '男孩图片1在广场图片2上骑着自行车图片3。\n声音参考关系：图片1中的角色使用音频1的声线参考。');
    assert.equal(body.generate_audio, true);
    assert.equal(body.task_type, undefined);
  });

  it('never allows the Seedance omni builder to disable generated audio', () => {
    const body = buildVolcengineOmniRequestBody({
      model: 'doubao-seedance-2-0-260128', prompt: '测试', generateAudio: false,
    });
    assert.equal(body.generate_audio, true);
  });

  it('always disables watermark and only adds the official web search tool when enabled', () => {
    const defaults = buildVolcengineOmniRequestBody({
      model: 'doubao-seedance-2-0-260128', prompt: '测试', watermark: true,
    });
    assert.equal(defaults.watermark, false);
    assert.equal(defaults.tools, undefined);

    const withSearch = buildVolcengineOmniRequestBody({
      model: 'doubao-seedance-2-0-260128', prompt: '搜索今天的天气', webSearch: true,
    });
    assert.deepEqual(withSearch.tools, [{ type: 'web_search' }]);
    assert.equal(withSearch.generate_audio, true);
    assert.equal(withSearch.watermark, false);
  });
});
