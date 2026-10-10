"""
Sanitizes the HTML written by the frontend's RichTextEditor (notes, services
provided) before it is stored. The browser renders it with v-html, so anything
outside what the editor can produce is stripped: scripts, event handlers,
styles, iframes, javascript: links. Text inside removed tags is kept, except
for <script>/<style>, whose content is dropped.

Keep in sync with frontend/src/utils/sanitizeHtml.ts.
"""
import nh3

# What TipTap's StarterKit (minus headings/code/quotes) + Underline + our list
# extensions emit. b/i are kept for content pasted from elsewhere.
_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a"}

# Lists carry their bullet style in data-marker (see RichTextEditor.vue).
_ATTRIBUTE_VALUES = {
    "ul": {"data-marker": {"disc", "circle", "square"}},
    "ol": {"data-marker": {"decimal"}},
}


def clean_rich_text(html: str | None) -> str | None:
    """Sanitized HTML, or None when nothing is left (matches `x or None` storage)."""
    if not html:
        return None
    cleaned = nh3.clean(
        html,
        tags=_TAGS,
        attributes={"a": {"href"}},
        tag_attribute_values=_ATTRIBUTE_VALUES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )
    return cleaned or None
