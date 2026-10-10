import pytest

from app.rich_text import clean_rich_text

# What the editor actually produces must come back unchanged.
EDITOR_OUTPUT = (
    '<p><strong>Scope</strong> of <em>work</em> <u>today</u><br>next line</p>'
    '<ul data-marker="circle"><li><p>one</p></li></ul>'
    '<ol data-marker="decimal"><li><p>two</p></li></ol>'
    '<p><a href="https://example.com" rel="noopener noreferrer">site</a></p>'
)


def test_editor_output_is_kept():
    assert clean_rich_text(EDITOR_OUTPUT) == EDITOR_OUTPUT


@pytest.mark.parametrize("dirty, clean", [
    ("<script>alert(1)</script><p>ok</p>", "<p>ok</p>"),
    ('<p onmouseover="alert(1)" style="color:red">ok</p>', "<p>ok</p>"),
    ('<img src=x onerror="alert(1)">', None),
    ('<iframe src="https://evil.example"></iframe>', None),
    ('<a href="javascript:alert(1)">x</a>', '<a rel="noopener noreferrer">x</a>'),
    ('<ul data-marker="url(evil)"><li>x</li></ul>', "<ul><li>x</li></ul>"),
    ("<h1>Title</h1>", "Title"),
    ("", None),
    (None, None),
])
def test_unsafe_markup_is_stripped(dirty, clean):
    assert clean_rich_text(dirty) == clean
