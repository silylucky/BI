"""Register a CJK-capable font for reportlab PDF export."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

FONT_NAME = "VitalSpanCJK"
CID_FONT_NAME = "STSong-Light"

_PACKAGE_DIR = Path(__file__).resolve().parent

_FONT_CANDIDATES: tuple[Path, ...] = (
    _PACKAGE_DIR / "fonts" / "NotoSansSC-Regular.otf",
    _PACKAGE_DIR / "fonts" / "NotoSansSC-Regular.ttf",
    Path(r"C:/Windows/Fonts/msyh.ttc"),
    Path(r"C:/Windows/Fonts/msyhbd.ttc"),
    Path(r"C:/Windows/Fonts/simsun.ttc"),
    Path(r"C:/Windows/Fonts/simhei.ttf"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
    Path("/System/Library/Fonts/STHeiti Light.ttc"),
)


def _register_cid_font() -> str | None:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont

    if CID_FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return CID_FONT_NAME
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(CID_FONT_NAME))
        return CID_FONT_NAME
    except Exception:
        return None


@lru_cache(maxsize=1)
def resolve_report_pdf_font_name() -> str:
    """Return registered CJK font name; prefer bundled/system TTF, else ReportLab CID."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    if FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return FONT_NAME

    for path in _FONT_CANDIDATES:
        if not path.is_file():
            continue
        try:
            if path.suffix.lower() == ".ttc":
                pdfmetrics.registerFont(TTFont(FONT_NAME, str(path), subfontIndex=0))
            else:
                pdfmetrics.registerFont(TTFont(FONT_NAME, str(path)))
            return FONT_NAME
        except Exception:
            continue

    cid = _register_cid_font()
    if cid:
        return cid
    return "Helvetica"


def reset_report_pdf_font_cache_for_tests() -> None:
    resolve_report_pdf_font_name.cache_clear()
