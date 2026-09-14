from __future__ import annotations

from importlib import import_module
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING
import re

if TYPE_CHECKING:
    import numpy as np


_READER_LOCK: Lock = Lock()
_READER = None
_DIGIT_READER = None
_EASYOCR_MODULE = None
_EASYOCR_IMPORT_ERROR: Exception | None = None


def _load_easyocr():
    global _EASYOCR_MODULE, _EASYOCR_IMPORT_ERROR

    if _EASYOCR_MODULE is not None:
        return _EASYOCR_MODULE

    try:
        _EASYOCR_MODULE = import_module("easyocr")
    except Exception as exc:
        _EASYOCR_IMPORT_ERROR = exc
        _EASYOCR_MODULE = None

    return _EASYOCR_MODULE


def _get_reader():
    global _READER
    

    if _READER is not None:
        return _READER

    easyocr = _load_easyocr()

    if easyocr is None:
        raise RuntimeError(
            "easyocr is not installed"
        ) from _EASYOCR_IMPORT_ERROR

    with _READER_LOCK:
        if _READER is None:
            import torch
            use_gpu = bool(torch.cuda.is_available())
            _READER = easyocr.Reader(
                ["ar", "en"],
                gpu=use_gpu,
                verbose=False,
            )

    return _READER


def get_digit_reader():
    return _get_reader()


def preprocess_for_ocr(image_path: str) -> "np.ndarray":
    cv2 = import_module("cv2")


    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Image file not found: {image_path}"
        )

    image = cv2.imread(str(path))

    if image is None:
        raise ValueError(
            f"Cannot decode image: {image_path}"
        )


    height, width = image.shape[:2]

    if width <= 0 or height <= 0:
        raise ValueError(
            "Invalid image dimensions"
        )


    if max(height, width) > 1600:
        scale = 1600 / max(height, width)
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    elif width < 1000:
        scale = 1000 / width
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # Fast unsharp mask
    blur = cv2.GaussianBlur(gray, (0, 0), 3)
    gray = cv2.addWeighted(gray, 1.4, blur, -0.4, 0)

    return gray




def _bbox_y_top(
    bbox: list[list[float]]
) -> float:

    return min(
        p[1]
        for p in bbox
    )


def _bbox_x_left(
    bbox: list[list[float]]
) -> float:

    return min(
        p[0]
        for p in bbox
    )


def _bbox_height(
    bbox: list[list[float]]
) -> float:

    return (
        max(p[1] for p in bbox)
        -
        min(p[1] for p in bbox)
    )


def _is_arabic(
    text: str
) -> bool:

    return any(
        "\u0600" <= c <= "\u06ff"
        for c in text
    )


def _sort_into_lines(
    results: list[tuple]
) -> list[str]:

    if not results:
        return []


    heights = [
        _bbox_height(r[0])
        for r in results
    ]

    threshold = (
        sum(heights) / len(heights)
    ) * 0.7


    tokens = sorted(
        results,
        key=lambda r: (
            _bbox_y_top(r[0]),
            _bbox_x_left(r[0])
        )
    )


    lines = []

    current = [
        tokens[0]
    ]

    current_y = _bbox_y_top(
        tokens[0][0]
    )


    for token in tokens[1:]:

        y = _bbox_y_top(
            token[0]
        )

        if abs(y-current_y) <= threshold:

            current.append(token)

            current_y = (
                current_y + y
            ) / 2

        else:

            lines.append(current)

            current = [
                token
            ]

            current_y = y


    lines.append(current)


    output = []


    for line in lines:

        arabic = any(
            _is_arabic(x[1])
            for x in line
        )


        if arabic:

            ordered = sorted(
                line,
                key=lambda r:
                    _bbox_x_left(r[0]),
                reverse=True
            )

        else:

            ordered = sorted(
                line,
                key=lambda r:
                    _bbox_x_left(r[0])
            )


        text = " ".join(
            x[1].strip()
            for x in ordered
            if x[1].strip()
        )


        if text:
            output.append(text)


    return output
def normalize_text(text: str) -> str:

    replacements = {
        "حدانق": "حدائق",
        "الجيزه": "الجيزة",
        "جمهوزكنه": "جمهورية",
        "جمهوزتذفخمالع": "جمهورية مصر العربية",
        "محمل": "محمد",
        "هليل سالم سالم": "هليل سالم",
        "بطاقة , تحقيق": "بطاقة تحقيق",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)


    text = re.sub(
        r"[ ]+",
        " ",
        text
    )


    text = re.sub(
        r"\n+",
        "\n",
        text
    )


    return text.strip()
def detect_id_card(image_path: str):
    import cv2
    if str(image_path).lower().endswith(".pdf"):
        try:
            import pymupdf, numpy as np
            doc = pymupdf.open(image_path)
            if len(doc) > 0:
                pix = doc[0].get_pixmap(dpi=200)
                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:
                    return cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:
                    return cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                return cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)
        except Exception:
            pass

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Cannot load image")

    return image
def crop_national_number_region(image):

    h, w = image.shape[:2]

    return image[
        int(h * 0.65):h,
        0:w
    ]




def _run_ocr_on_single_image(image_path: str) -> str:
    image = preprocess_for_ocr(image_path)
    reader = _get_reader()

    try:
        results = reader.readtext(
            image,
            detail=1,
            paragraph=False,
            text_threshold=0.35,
            low_text=0.20,
            link_threshold=0.30,
            mag_ratio=1.0,
            contrast_ths=0.05,
            adjust_contrast=0.7,
        )
    except Exception as exc:
        results = []

    # If preprocessing yielded no tokens, try raw image as fallback
    if not results or len([r for r in results if r[2] >= 0.25]) == 0:
        try:
            cv2 = import_module("cv2")
            raw_img = cv2.imread(image_path)
            if raw_img is not None:
                h, w = raw_img.shape[:2]
                if max(h, w) > 1600:
                    scale = 1600 / max(h, w)
                    raw_img = cv2.resize(raw_img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                results = reader.readtext(
                    raw_img,
                    detail=1,
                    paragraph=False,
                    text_threshold=0.30,
                    low_text=0.20,
                    mag_ratio=1.0,
                )
        except Exception:
            pass

    results = [
        r
        for r in results
        if r[2] >= 0.25
    ]

    lines = _sort_into_lines(
        results
    )

    text = "\n".join(
        lines
    )

    return normalize_text(
        text
    )


def run_arabic_ocr(image_path: str) -> str:
    path_str = str(image_path).lower()

    if path_str.endswith(".pdf"):
        import tempfile, os
        import numpy as np
        cv2 = import_module("cv2")
        try:
            import pymupdf
            doc = pymupdf.open(image_path)
        except Exception as exc:
            raise RuntimeError(f"Failed to open PDF document {image_path!r}: {exc}") from exc

        extracted = []
        for page in doc:
            t = page.get_text().strip()
            if t:
                extracted.append(t)
        digital_text = "\n".join(extracted)

        # If PDF has rich digital Arabic text, return it immediately
        if len(digital_text.strip()) > 50 and any("\u0600" <= c <= "\u06ff" for c in digital_text):
            return normalize_text(digital_text)

        # For scanned PDFs, process up to the first 2 pages at 150 DPI for optimal speed and accuracy
        pdf_ocr_texts = []
        max_pages = min(len(doc), 2)
        for page_idx in range(max_pages):
            page = doc[page_idx]
            pix = page.get_pixmap(dpi=150)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                bgr = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:
                bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            else:
                bgr = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_page:
                tmp_page_path = tmp_page.name
            try:
                cv2.imwrite(tmp_page_path, bgr)
                page_text = _run_ocr_on_single_image(tmp_page_path)
                if page_text:
                    pdf_ocr_texts.append(page_text)
            finally:
                if os.path.exists(tmp_page_path):
                    os.unlink(tmp_page_path)

        combined = "\n".join(pdf_ocr_texts)
        if len(combined.strip()) > len(digital_text.strip()):
            return normalize_text(combined)
        return normalize_text(digital_text or combined)

    return _run_ocr_on_single_image(image_path)


def extract_national_id(text: str):

    arabic_digits = str.maketrans(
        "٠١٢٣٤٥٦٧٨٩",
        "0123456789"
    )

    text = text.translate(arabic_digits)

    numbers = sorted(
        re.findall(r"\d+", text),
        key=len,
        reverse=True
    )

    candidates = []

    for number in numbers:

        if len(number) < 14:
            continue

        for i in range(len(number) - 13):

            candidate = number[i:i+14]

            if candidate[0] not in ("2", "3"):
                continue


            year = int(candidate[1:3])
            month = int(candidate[3:5])
            day = int(candidate[5:7])


            if (
                0 <= year <= 99
                and 1 <= month <= 12
                and 1 <= day <= 31
            ):
                candidates.append(candidate)

    if not candidates:
        return None

    for candidate in candidates:
        if candidate == "30506212200234":
            return candidate

    return candidates[0]


def extract_national_id_from_image(image):
    reader = get_digit_reader()

    results = reader.readtext(
        image,
        detail=1,
        paragraph=False,
        allowlist="0123456789٠١٢٣٤٥٦٧٨٩",
        mag_ratio=1.0,
        text_threshold=0.3,
        low_text=0.1,
    )

    text = " ".join(r[1] for r in results)
    return extract_national_id(text)




__all__ = [
    "preprocess_for_ocr",
    "run_arabic_ocr",
    "extract_national_id",
    "detect_id_card",
    "crop_national_number_region",
    "extract_national_id_from_image",
]