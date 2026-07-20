import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeOmniPromptSpacing,
  removeOmniReferenceFromPrompt,
  validateOmniPromptReferences,
} from '../src/utils/omniReferences.js'

test('three omni references remain bound by slot even when mentioned out of order', () => {
  const prompt = '男孩@图片1在广场@图片3上骑着自行车@图片2。'
  const result = validateOmniPromptReferences(prompt, 3)

  assert.equal(result.valid, true)
  assert.deepEqual(result.numbers, [1, 3, 2])
  assert.equal(
    normalizeOmniPromptSpacing(prompt),
    '男孩@图片1 在广场@图片3 上骑着自行车@图片2。',
  )
})

test('omni validation reports references that are missing or outside the image array', () => {
  const result = validateOmniPromptReferences('@图片1 和 @图片4', 3)
  assert.equal(result.valid, false)
  assert.deepEqual(result.invalid, [4])
  assert.deepEqual(result.missing, [2, 3])
})

test('removing an image deletes its tag and shifts later canonical slots', () => {
  assert.equal(
    removeOmniReferenceFromPrompt('@图片1 看向 @图片2，远处是 @图片3', 2),
    '@图片1 看向 ，远处是 @图片2',
  )
})
