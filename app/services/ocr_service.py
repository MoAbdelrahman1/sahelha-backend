from __future__ import annotations

from importlib import import_module
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import numpy as np


_READER_LOCK = Lock()
_READER = None
_EASYOCR_MODULE = None
_EASYOCR_IMPORT_ERROR: Exception | None = None


def _load_easyocr():
    global _EASYOCR_MODULE, _EASYOCR_IMPORT_ERROR

    if _EASYOCR_MODULE is not None:
        return _EASYOCR_MODULE

    try:
        _EASYOCR_MODULE = import_module("easyocr")
    except Exception as exc:  # pragma: no cover - depends on local environment
        _EASYOCR_IMPORT_ERROR = exc
        _EASYOCR_MODULE = None
    return _EASYOCR_MODULE


def _get_reader():
    global _READER

    if _READER is not None:
        return _READER

    easyocr = _load_easyocr()
    if easyocr is None:
        raise RuntimeError("easyocr is not installed") from _EASYOCR_IMPORT_ERROR

    with _READER_LOCK:
        if _READER is None:
            _READER = easyocr.Reader(["ar", "en"], gpu=False, verbose=False)
    return _READER


def preprocess_for_ocr(image_path: str) -> "np.ndarray":
    cv2 = import_module("cv2")
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"Unable to read image: {image_path}")

    height, width = image.shape[:2]
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid image dimensions for: {image_path}")

    if width < 1000:
        scale_factor = 1000.0 / float(width)
        image = cv2.resize(
            image,
            None,
            fx=scale_factor,
            fy=scale_factor,
            interpolation=cv2.INTER_CUBIC,
        )

    return image


def _clean_ocr_segments(segments: list[str] | tuple[str, ...] | object) -> str:
    if not segments:
        return ""

    if isinstance(segments, (str, bytes)):
        candidate_segments = [segments.decode("utf-8") if isinstance(segments, bytes) else segments]
    elif isinstance(segments, (list, tuple)):
        candidate_segments = []
        for segment in segments:
            if isinstance(segment, (list, tuple)):
                candidate_segments.extend(str(value) for value in segment if str(value).strip())
            elif segment is not None:
                candidate_segments.append(str(segment))
    else:
        candidate_segments = [str(segments)]

    cleaned_parts = [" ".join(part.split()) for part in candidate_segments if str(part).strip()]
    return " ".join(part for part in cleaned_parts if part).strip()


def run_arabic_ocr(image_path: str) -> str:
    preprocessed_image = preprocess_for_ocr(image_path)
    reader = _get_reader()

    try:
        ocr_segments = reader.readtext(preprocessed_image, detail=0, paragraph=True)
    except Exception as exc:
        raise RuntimeError(f"OCR extraction failed for {image_path}") from exc

    return _clean_ocr_segments(ocr_segments)


__all__ = ["preprocess_for_ocr", "run_arabic_ocr"]
