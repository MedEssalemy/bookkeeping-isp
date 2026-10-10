// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('keeps what the rich text editor produces', () => {
    const html =
      '<p><strong>Scope</strong> of <em>work</em> <u>today</u><br>next</p>' +
      '<ul data-marker="square"><li><p>one</p></li></ul>' +
      '<ol data-marker="decimal"><li><p>two</p></li></ol>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it.each([
    ['<p>ok</p><script>alert(1)</script>', '<p>ok</p>'],
    ['<p onclick="alert(1)" style="color:red">ok</p>', '<p>ok</p>'],
    ['<img src="x" onerror="alert(1)">', ''],
    ['<iframe src="https://evil.example"></iframe>', ''],
    ['<a href="javascript:alert(1)">x</a>', '<a rel="noopener noreferrer">x</a>'],
    ['<a href="https://example.com">x</a>', '<a href="https://example.com" rel="noopener noreferrer">x</a>'],
    ['<p data-evil="1" class="x">ok</p>', '<p>ok</p>'],
    ['<ul data-marker="url(evil)"><li>x</li></ul>', '<ul><li>x</li></ul>'],
    ['<p data-marker="square">x</p>', '<p>x</p>'],
  ])('strips unsafe markup: %s', (dirty, clean) => {
    expect(sanitizeHtml(dirty)).toBe(clean)
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})
