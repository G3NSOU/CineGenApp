export function normalizeOmniPromptSpacing(value) {
  return String(value || '')
    .replace(/@图片(\d+)(?=[\u4e00-\u9fffA-Za-z「『【（])/gu, '@图片$1 ')
    .replace(/[ \t]+\n/g, '\n')
}

export function omniPromptReferenceNumbers(value) {
  const out = []
  const seen = new Set()
  const re = /@图片(\d+)/g
  let match
  while ((match = re.exec(String(value || ''))) !== null) {
    const number = Number(match[1])
    if (!seen.has(number)) {
      seen.add(number)
      out.push(number)
    }
  }
  return out
}

export function validateOmniPromptReferences(value, referenceCount, options = {}) {
  const count = Math.max(0, Number(referenceCount) || 0)
  const requireAll = options.requireAll !== false
  const numbers = omniPromptReferenceNumbers(value)
  const invalid = numbers.filter((number) => number < 1 || number > count)
  const missing = requireAll
    ? Array.from({ length: count }, (_, index) => index + 1).filter((number) => !numbers.includes(number))
    : []
  return {
    valid: count > 0 && invalid.length === 0 && missing.length === 0,
    numbers,
    invalid,
    missing,
  }
}

/** 删除一个参考图时保持其余素材语义：被删槽位移除，后续 @图片N 自动前移。 */
export function removeOmniReferenceFromPrompt(value, removedOneBased) {
  const removed = Number(removedOneBased)
  if (!Number.isFinite(removed) || removed < 1) return String(value || '')
  return String(value || '').replace(/@图片(\d+)/g, (token, rawNumber) => {
    const number = Number(rawNumber)
    if (number === removed) return ''
    if (number > removed) return `@图片${number - 1}`
    return token
  }).replace(/[ \t]{2,}/g, ' ')
}
