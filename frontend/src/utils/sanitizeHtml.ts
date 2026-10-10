import DOMPurify from 'dompurify'

/**
 * Sanitizes RichTextEditor HTML (notes, services provided) before it is shown
 * with v-html. The API already cleans it on save (backend/app/rich_text.py);
 * this second pass also covers anything stored before that, and keeps the UI
 * safe if another client ever writes to the API. Keep both allowlists in sync.
 */
const OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href'],
  // http(s) and mailto only — no javascript:, data:, etc.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
}

// Lists carry their bullet style in data-marker (see RichTextEditor.vue).
const MARKERS: Record<string, string[]> = {
  UL: ['disc', 'circle', 'square'],
  OL: ['decimal'],
}

let hooked = false

function installHooks(): void {
  // data-* attributes are allowed by DOMPurify's defaults; keep only a
  // data-marker with a known value on a list, drop every other one.
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (!data.attrName.startsWith('data-')) return
    const allowed = data.attrName === 'data-marker' && MARKERS[node.tagName]?.includes(data.attrValue)
    if (!allowed) data.keepAttr = false
  })
  // Links never get access back to this page.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer')
  })
  hooked = true
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (!hooked) installHooks()
  return DOMPurify.sanitize(html, OPTIONS)
}
