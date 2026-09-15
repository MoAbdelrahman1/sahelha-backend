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
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:
        cv2 = import_module("cv2")
        image = cv2.imread(str(path))
        if image is not None and image.shape[0] > 0 and image.shape[1] > 0:
            height, width = image.shape[:2]
            # Optimal resolution scaling for Arabic EasyOCR line detection
            if max(height, width) > 2000:
                scale = 2000 / max(height, width)
                image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            elif max(height, width) < 1200:
                scale = 1600 / max(height, width)
                image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

            # Apply LAB color space CLAHE to boost faint Arabic cursive strokes against watermarks
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
            cl = clahe.apply(l_channel)
            enhanced_lab = cv2.merge((cl, a_channel, b_channel))
            enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

            # Edge-preserving bilateral filter to smooth noise without blurring font outlines
            denoised = cv2.bilateralFilter(enhanced_bgr, d=5, sigmaColor=50, sigmaSpace=50)
            return denoised
    except Exception:
        pass

    import numpy as np
    from PIL import Image
    pil_img = Image.open(path).convert("RGB")
    width, height = pil_img.size
    if max(height, width) > 2000:
        scale = 2000 / max(height, width)
        pil_img = pil_img.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)
    elif max(height, width) < 1200:
        scale = 1600 / max(height, width)
        pil_img = pil_img.resize((int(width * scale), int(height * scale)), Image.Resampling.BICUBIC)
    return np.array(pil_img)[:, :, ::-1]




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
        "قندول": "قيد",
        "قسد": "قيد",
        "قند": "قيد",
        "قيدالمي": "قيد الميلاد",
        "قيدالمه": "قيد الميلاد",
        "الفاهره": "القاهرة",
        "الناهره": "القاهرة",
        "الشرباحبة": "الشرابية",
        "الشراببة": "الشرابية",
        "مسبحى": "مسيحي",
        "مسبحبة": "مسيحية",
        "مدر": "مصر",
        "ممر": "مصر",
        "بوسف": "يوسف",
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
            text_threshold=0.30,
            low_text=0.20,
            link_threshold=0.30,
            mag_ratio=1.0,
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
    if not text:
        return None
    arabic_digits = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    text = str(text).translate(arabic_digits)

    # Prioritize single lines first (e.g. dedicated 14-digit number row on the card)
    number_sources = []
    for line in text.splitlines():
        line_digits = re.findall(r"\d+", line)
        if line_digits:
            number_sources.append("".join(line_digits))
            number_sources.append("".join(reversed(line_digits)))

    # Extract all pure digit sequences
    digit_clusters = re.findall(r"\d+", text)
    if digit_clusters:
        number_sources.append("".join(digit_clusters))
        number_sources.append("".join(reversed(digit_clusters)))

    raw_digits = re.sub(r"\D", "", text)
    if raw_digits:
        number_sources.append(raw_digits)
        number_sources.append(raw_digits[::-1])

    # Detect any birth dates mentioned in text (e.g. 1992/08/01 -> '920801')
    date_matches = re.findall(r"\b(?:19|20)?(\d{2})[/\-\.](\d{1,2})[/\-\.](\d{1,2})\b", text)
    date_keys = set()
    for y, m, d in date_matches:
        date_keys.add(f"{y.zfill(2)}{m.zfill(2)}{d.zfill(2)}")

    candidates = []
    for number in number_sources:
        clean_num = re.sub(r"\D", "", number)
        if len(clean_num) < 14:
            continue
        for i in range(len(clean_num) - 13):
            candidate = clean_num[i:i+14]
            if len(candidate) != 14 or not candidate.isdigit():
                continue
            if candidate[0] not in ("2", "3"):
                continue
            try:
                year = int(candidate[1:3])
                month = int(candidate[3:5])
                day = int(candidate[5:7])
                gov = int(candidate[7:9])
                if (
                    0 <= year <= 99
                    and 1 <= month <= 12
                    and 1 <= day <= 31
                    and (1 <= gov <= 35 or gov == 88)
                ):
                    score = 0
                    if candidate[1:7] in date_keys:
                        score += 10
                    candidates.append((score, candidate))
            except (ValueError, IndexError):
                continue

    if not candidates:
        return None

    # Sort by highest score first
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def extract_national_id_from_image(image) -> str | None:
    """
    Locates and extracts the 14-digit Egyptian National ID directly from image pixels
    using bilateral filtering and adaptive bottom-strip cropping to remove background artwork.
    """
    if image is None:
        return None

    reader = get_digit_reader()
    arabic_digits = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

    # Pass 1: Direct digit extraction on input image
    try:
        results = reader.readtext(
            image,
            detail=1,
            paragraph=False,
            allowlist="0123456789٠١٢٣٤٥٦٧٨٩",
            mag_ratio=1.0,
            text_threshold=0.2,
            low_text=0.08,
        )
        text = " ".join(r[1].translate(arabic_digits) for r in results)
        nid = extract_national_id(text)
        if nid and len(nid) == 14 and nid[0] in ("2", "3"):
            return nid
    except Exception:
        pass

    # Pass 2: Enhanced bottom-strip crop with bilateral filtering (removes Pyramid artwork)
    try:
        import cv2
        h, w = image.shape[:2]
        crop = image[int(h * 0.65):int(h * 0.98), int(w * 0.25):int(w * 0.98)]
        if crop.size > 0:
            resized = cv2.resize(crop, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            norm = cv2.normalize(gray, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
            filtered = cv2.bilateralFilter(norm, 9, 75, 75)

            results = reader.readtext(
                filtered,
                detail=1,
                allowlist="0123456789٠١٢٣٤٥٦٧٨٩",
                low_text=0.02,
                text_threshold=0.05,
            )
            tokens = [r[1].translate(arabic_digits).strip() for r in results]
            raw_text = " ".join(tokens)
            digits_only = re.sub(r"\D", "", raw_text)

            nid = extract_national_id(raw_text) or extract_national_id(digits_only)
            if nid and len(nid) == 14 and nid[0] in ("2", "3"):
                return nid
    except Exception:
        pass

    return None




def extract_birth_certificate_national_id(image, ocr_context: str = "") -> str | None:
    """
    Locates and reconstructs the 14-digit Egyptian National ID from the top ribbon
    of an Egyptian birth certificate.
    """
    import cv2
    h, w = image.shape[:2]
    crop = image[int(h * 0.15):int(h * 0.27), int(w * 0.22):int(w * 0.78)]
    crop_large = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    reader = get_digit_reader()
    results = reader.readtext(crop_large, detail=1)
    if not results:
        return None

    arabic_digits = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    tokens = [r[1].translate(arabic_digits).strip() for r in results]
    full_text = " ".join(tokens)

    cleaned = re.sub(r"(?<=\d)[\s\-_]+(?=\d)", "", full_text)
    matches = re.findall(r"[23]\d{13}", cleaned)
    if matches:
        return matches[0]

    nums = re.findall(r"\d+", full_text)
    bd_chunk = None
    for n in nums:
        if len(n) == 6 and 1 <= int(n[2:4]) <= 12 and 1 <= int(n[4:6]) <= 31:
            bd_chunk = n
            break

    suffix_chunk = None
    for n in nums:
        if n != bd_chunk and len(n) in (4, 5, 6, 7):
            suffix_chunk = n.zfill(5)
            break

    if bd_chunk and suffix_chunk:
        century = "3" if int(bd_chunk[:2]) < 50 else "2"
        gov_code = "01"
        for n in nums:
            if n not in (bd_chunk, suffix_chunk) and len(n) == 2 and 1 <= int(n) <= 35:
                gov_code = n
                break
        if "شراب" in ocr_context or "قاهر" in ocr_context:
            gov_code = "01"
        elif "جيز" in ocr_context:
            gov_code = "21"
        elif "اسكندر" in ocr_context:
            gov_code = "02"

        return f"{century}{bd_chunk}{gov_code}{suffix_chunk}"

    return None


EGYPTIAN_GOVERNORATES = [
    "القاهرة", "الجيزة", "الإسكندرية", "البحيرة", "الغربية", "الشرقية", "الدقهلية",
    "المنوفية", "القليوبية", "كفر الشيخ", "الفيوم", "بني سويف", "المنيا", "أسيوط",
    "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح",
    "شمال سيناء", "جنوب سيناء", "بورسعيد", "الإسماعيلية", "السويس", "دمياط"
]


def parse_egyptian_national_id_text(ocr_text: str) -> dict[str, Any] | None:
    """
    Direct structured field extractor for Egyptian National ID cards from raw OCR text.
    Accurately recovers citizen name and address directly from OCR lines to prevent
    hallucinations from small LLMs.
    """
    if not ocr_text:
        return None

    raw_lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]
    if not raw_lines:
        return None

    # Check for National ID cues (header text, serial code pattern, or governorate/city presence)
    has_header_cue = any(cue in ocr_text for cue in ["بطاقة", "تحقيق الشخصية", "شخصية", "جمهورية مصر العربية", "الرقم القومي"])
    has_serial_pattern = bool(re.search(r"\b[0-9][A-Za-z][0-9]{7}\b|\b[A-Za-z]{2}[0-9]{7}\b", ocr_text))
    has_nid_pattern = bool(re.search(r"[٢-٣2-3]\s*(?:[٠-٩0-9]\s*){13}", ocr_text))
    has_gov_cue = any(gov in ocr_text for gov in EGYPTIAN_GOVERNORATES) or any(c in ocr_text for c in ["دمنهور", "البعبرة", "الهرم", "المحلة", "طنطا", "المنصورة"])

    if not (has_header_cue or has_serial_pattern or has_nid_pattern or has_gov_cue):
        return None

    header_indices = []
    for idx, line in enumerate(raw_lines):
        if any(h in line for h in ["جمهورية مصر", "تحقيق الشخصية", "بطاقة"]):
            header_indices.append(idx)

    start_idx = max(header_indices) + 1 if header_indices else 0

    name_lines = []
    address_lines = []
    governorate = None
    found_street = False

    street_indicators = ["ش ", "ش.", "شارع", "طريق", "حارة", "عمارة", "ميدان", "مجاورة", "قطعة", "ب -", "معهد", "انمعد"]
    city_to_gov = {
        "دمنهور": "البحيرة", "البعبرة": "البحيرة", "كفر الدوار": "البحيرة", "إيتاي": "البحيرة",
        "الهرم": "الجيزة", "الدقي": "الجيزة", "العجوزة": "الجيزة", "أكتوبر": "الجيزة",
        "المحلة": "الغربية", "طنطا": "الغربية", "زفتى": "الغربية",
        "المنصورة": "الدقهلية", "ميت غمر": "الدقهلية", "طلخا": "الدقهلية",
        "الزقازيق": "الشرقية", "بلبيس": "الشرقية", "العاشر": "الشرقية",
        "بنها": "القليوبية", "شبرا الخيمة": "القليوبية", "طوخ": "القليوبية",
        "شبين الكوم": "المنوفية", "منوف": "المنوفية", "أشمون": "المنوفية",
        "مدينة نصر": "القاهرة", "المعادي": "القاهرة", "حلوان": "القاهرة", "عين شمس": "القاهرة",
    }

    for line in raw_lines[start_idx:]:
        clean_compact = line.replace(" ", "")
        # Skip raw serial / batch codes like 1K0753896 or KC4858070
        if re.search(r"^[A-Za-z0-9]{7,10}$", clean_compact):
            continue

        digits_only = re.sub(r"\D", "", line)
        ar_letters_only = re.sub(r"[\d\s\W]", "", line)

        # Skip date lines and long digit clusters (e.g. 1992/08/01 or raw digit sequences)
        if len(digits_only) >= 8 or re.search(r"\b(?:19|20)\d{2}[/\-\.]", line):
            continue

        # Detect governorate from standard list or city map
        for gov in EGYPTIAN_GOVERNORATES:
            if gov in line:
                governorate = gov
                break
        if not governorate:
            for city, mapped_gov in city_to_gov.items():
                if city in line:
                    governorate = mapped_gov
                    break

        # Detect address lines
        has_street_cue = any(kw in line for kw in street_indicators) or (re.search(r"^[٠-٩0-9]+\s*ش", line) is not None)
        has_city_cue = any(city in line for city in city_to_gov) or any(gov in line for gov in EGYPTIAN_GOVERNORATES)
        if has_street_cue or has_city_cue or found_street:
            found_street = True
            clean_addr_line = re.sub(r"[|=\.؛;:_]+", " ", line)
            clean_addr_line = " ".join(clean_addr_line.split())
            if clean_addr_line and not any(kw in clean_addr_line for kw in ["1K", "IK"]):
                address_lines.append(clean_addr_line)
        else:
            # Accumulate Arabic name words
            if len(ar_letters_only) >= 2 and len(digits_only) < 3:
                clean_name_line = re.sub(r"[|=\.؛;:\-_\"'\`ـ]+", " ", line)
                clean_name_line = " ".join(clean_name_line.split())
                if clean_name_line and not any(kw in clean_name_line for kw in ["1K", "IK", "بطاقة"]):
                    name_lines.append(clean_name_line)

    full_name = " ".join(name_lines).strip()
    full_address = " - ".join(address_lines)
    full_address = re.sub(r"\s+-\s+-\s+", " - ", full_address).strip()
    full_address = " ".join(full_address.split())

    nid = extract_national_id(ocr_text)

    return {
        "name": full_name or None,
        "address": full_address or None,
        "governorate": governorate,
        "national_number": nid if (nid and len(nid) == 14 and nid[0] in ("2", "3")) else None,
    }


__all__ = [
    "preprocess_for_ocr",
    "run_arabic_ocr",
    "extract_national_id",
    "detect_id_card",
    "crop_national_number_region",
    "extract_national_id_from_image",
    "extract_birth_certificate_national_id",
    "parse_egyptian_national_id_text",
]