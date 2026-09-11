import json
import re
import difflib
from pathlib import Path
from typing import Optional, Dict, Any, List

DATASET_PATH = Path(__file__).parent.parent / "data" / "digital_gov_dataset.json"

_DATASET_CACHE: List[Dict[str, Any]] = []

def load_dataset() -> List[Dict[str, Any]]:
    global _DATASET_CACHE
    if _DATASET_CACHE:
        return _DATASET_CACHE

    if DATASET_PATH.exists():
        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                _DATASET_CACHE = json.load(f)
                print(f"[RAG SERVICE] Loaded {len(_DATASET_CACHE)} government services from {DATASET_PATH.name}")
        except Exception as e:
            print(f"[RAG SERVICE] Error reading dataset: {e}")
            _DATASET_CACHE = []
    return _DATASET_CACHE

def _normalize_arabic(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[أإآ]", "ا", text)
    text = re.sub(r"ى", "ي", text)
    text = re.sub(r"ؤ", "ء", text)
    text = re.sub(r"ئ", "ء", text)
    text = re.sub(r"[ًٌٍَُِّْـ]", "", text)
    return text.lower()


def search_government_rag(query: str) -> Optional[Dict[str, Any]]:
    """Search digital.gov.eg dataset for the best matching government service."""
    dataset = load_dataset()
    if not dataset or not query:
        return None

    norm_query = _normalize_arabic(query.strip())

    # Map of ID to dataset item for quick lookup
    items_by_id = {item.get("id"): item for item in dataset if item.get("id")}

    # 1. Deterministic keyword routing rules for high-precision matching
    # Marriage certificate
    if any(k in norm_query for k in ["زواج", "قباله", "قوشان", "ماذون"]):
        if "CSOFA-MARRIAGE-CERTIFICATE" in items_by_id:
            return items_by_id["CSOFA-MARRIAGE-CERTIFICATE"]

    # Divorce certificate
    if any(k in norm_query for k in ["طلاق", "اشهاد طلاق", "مطلقه", "مطلق"]):
        if "CSOFA-DIVORCE-CERTIFICATE" in items_by_id:
            return items_by_id["CSOFA-DIVORCE-CERTIFICATE"]

    # Death certificate
    if any(k in norm_query for k in ["وفاه", "توفي", "دفن", "المتوفى", "المتوفيه"]):
        if "CSOFA-DEATH-CERTIFICATE" in items_by_id:
            return items_by_id["CSOFA-DEATH-CERTIFICATE"]

    # Birth certificate
    if any(k in norm_query for k in ["ميلاد", "مولود", "اخطار ولاده", "الولاده", "سبوع"]):
        if "تموين" not in norm_query and "CSOFA-BIRTH-CERTIFICATE" in items_by_id:
            return items_by_id["CSOFA-BIRTH-CERTIFICATE"]

    # Family registration
    if any(k in norm_query for k in ["قيد عايلي", "قيد عائلي", "العايلي", "العائلي"]):
        if "CSOFA-FAMILY-REGISTRATION" in items_by_id:
            return items_by_id["CSOFA-FAMILY-REGISTRATION"]

    # National ID
    if any(k in norm_query for k in ["بطاقه الرقم القومي", "الرقم القومي", "بطاقه شخصيه", "بطاقتي", "رقم قومي"]):
        if "CSOFA-ID-CARD" in items_by_id:
            return items_by_id["CSOFA-ID-CARD"]

    # Passport
    if any(k in norm_query for k in ["جواز السفر", "جواز سفر", "جوازات", "باسبور"]):
        if "PASSPORT-EGYPT" in items_by_id:
            return items_by_id["PASSPORT-EGYPT"]

    # Traffic Violations
    if any(k in norm_query for k in ["مخالفات", "تظلم", "رادار", "غرامات", "مخالفه"]):
        if "STRF-TRAFFIC-VIOLATIONS" in items_by_id:
            return items_by_id["STRF-TRAFFIC-VIOLATIONS"]

    # Driver's License
    if any(k in norm_query for k in ["قياده", "سواقه", "سايق", "رخصه قياده", "رخصه سواقه"]):
        if "STRF-DRIVERS-LICENSE" in items_by_id:
            return items_by_id["STRF-DRIVERS-LICENSE"]

    # Vehicle License Renewal
    if any(k in norm_query for k in ["مركبه", "عربيه", "سياره", "تسيير", "رخصه عربيه", "رخصه سياره", "رخصه مركبه"]):
        if "STRF-VEHICLE-LICENSE-RENEWAL" in items_by_id:
            return items_by_id["STRF-VEHICLE-LICENSE-RENEWAL"]

    # Tax Card
    if any(k in norm_query for k in ["ضريبي", "ضريبيه", "ضرايب", "ملف ضريبي", "بطاقه ضريبيه"]):
        if "CRA-TAX-CARD" in items_by_id:
            return items_by_id["CRA-TAX-CARD"]

    # Commercial Register
    if any(k in norm_query for k in ["سجل تجاري", "غرفه تجاريه", "مستخرج تجاري"]):
        if "CRA-COMMERCIAL-REGISTER" in items_by_id:
            return items_by_id["CRA-COMMERCIAL-REGISTER"]

    # Notary - Car sale contract vs general power of attorney
    if any(k in norm_query for k in ["عقد بيع سياره", "عقد بيع مركبه", "بيع عربيه", "بيع سياره"]):
        if "SNOT-CAR-SALE-CONTRACT" in items_by_id:
            return items_by_id["SNOT-CAR-SALE-CONTRACT"]

    if any(k in norm_query for k in ["توكيل", "شهر عقاري", "توثيق"]):
        if "SNOT-POWER-OF-ATTORNEY" in items_by_id:
            return items_by_id["SNOT-POWER-OF-ATTORNEY"]

    # Supply food card / dependents
    if any(k in norm_query for k in ["اضافه ابناء", "اضافه الافراد", "ضم افراد", "اضافه مولود تموين"]):
        if "SUPPLY-ADD-DEPENDENTS" in items_by_id:
            return items_by_id["SUPPLY-ADD-DEPENDENTS"]

    if any(k in norm_query for k in ["تموين", "بطاقه التموين", "خبز", "دعم تمويني"]):
        if "SUPPLY-FOOD-CARD" in items_by_id:
            return items_by_id["SUPPLY-FOOD-CARD"]

    # Social Insurance
    if any(k in norm_query for k in ["تأمين", "تامين", "تأميني", "تاميني", "برينت تاميني", "معاش", "تامينات"]):
        if "NOSI-SOCIAL-INSURANCE" in items_by_id:
            return items_by_id["NOSI-SOCIAL-INSURANCE"]

    # Social Housing
    if any(k in norm_query for k in ["اسكان", "شقه", "شقق", "تمويل عقاري"]):
        if "SHMFF-SOCIAL-HOUSING" in items_by_id:
            return items_by_id["SHMFF-SOCIAL-HOUSING"]

    # 2. Token overlap fallback if no direct keyword matches
    stop_words = {"انت", "عايز", "عاوز", "اطلع", "اعمل", "طريقه", "ازاي", "فين", "استخراج", "إصدار", "تجديد", "ايه", "المطلوب", "لكن", "من", "في", "على", "عن", "هل", "يا", "دي", "دول"}
    tokens = set([w for w in norm_query.split() if len(w) >= 2 and w not in stop_words])

    best_item = None
    best_score = 0

    if tokens:
        for item in dataset:
            text_to_search = _normalize_arabic(
                item.get("title", "") + " " +
                item.get("description", "") + " " +
                " ".join(item.get("dialects_qa", []))
            )
            score = sum(1 for t in tokens if t in text_to_search)
            if score > best_score:
                best_score = score
                best_item = item

    return best_item or (dataset[0] if dataset else None)


def format_rag_context_for_llm(matched_service: Dict[str, Any]) -> str:
    """Format matching RAG result into clean context for LLM prompt matching digital.gov.eg UI sections."""
    if not matched_service:
        return ""

    title = matched_service.get('title', '')
    docs = "\n".join(f"- {d}" for d in matched_service.get("required_documents", []))
    fees = matched_service.get('fees_and_delivery', '')

    return f"""\
بيانات الخدمة المعتمدة رسمياً من منصة (مصر الرقمية digital.gov.eg):
اسم الخدمة: {title}

المستندات المطلوبة الرسمية:
{docs}

الرسوم والمدة:
{fees}

تعليمات الإجابة الإلزامية:
- اذكر دائماً المستندات المطلوبة والرسوم بوضوح وبالعامية المصرية البسيطة.
- لا تضف أي مستندات من عندك غير المذكورة أعلاه.
"""
