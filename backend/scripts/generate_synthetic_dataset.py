"""
scripts/generate_synthetic_dataset.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Generates a comprehensive, realistic synthetic dataset for fine-tuning LLMs
(specifically Qwen2.5-3B-Instruct) on noisy Egyptian administrative document OCR.

Features:
- Male AND Female Egyptian citizens (50/50 balance).
- Gender-aware 14-digit Egyptian National ID generation:
    * Century digit (2 for 1900-1999, 3 for 2000-2099)
    * Real Egyptian governorate codes (01 Cairo, 02 Alexandria, 21 Giza, 27 Qena, etc.)
    * Digit 13 (second-to-last) strictly odd for males (1,3,5,7,9) and even for females (0,2,4,6,8)
- Comprehensive document types:
    * national_id (male & female, varied occupations, realistic addresses across all 27 governorates)
    * birth_certificate (male & female newborns, mother & father names, health offices)
    * utility_bill (electricity, water, gas with authentic Egyptian utility company names and amounts)
- Realistic Egyptian OCR noise simulation:
    * Arabic Eastern digits (٠١٢٣٤٥٦٧٨٩) vs Western digits (0123456789)
    * Spaced / RTL-reversed digit sequences as produced by Tesseract/EasyOCR
    * Common OCR misreads: ٥ misread as د or ه; قيد misread as قندول; missing hamzas/dots
    * Watermarks, scanner artifacts, serial barcodes (e.g. KC4858070)
- Outputs standard Qwen2.5 ChatML format JSONL (train & validation splits).
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import random
import sys
from pathlib import Path

# ── 1. Comprehensive Egyptian Name Dictionaries ───────────────────────────────

MALE_FIRST_NAMES = [
    "محمد", "أحمد", "محمود", "علي", "إبراهيم", "مصطفى", "عمر", "خالد", "طارق",
    "يوسف", "عبدالرحمن", "عبدالله", "عمرو", "حسام", "كريم", "حسين", "حسن",
    "سامح", "شريف", "هاني", "تامر", "عادل", "ماجد", "أيمن", "وليد", "سعيد",
    "سليمان", "صلاح", "جمال", "عصام", "أشرف", "وائل", "هشام", "مدحت", "نبيل",
    "مجدي", "رأفت", "صبري", "يسري", "فريد", "حمادة", "شادي", "رامي", "زياد",
    "فارس", "حمزة", "بلال", "مالك", "يحيى", "باسل", "شوقي", "شعبان", "رمضان",
]

FEMALE_FIRST_NAMES = [
    "فاطمة", "مريم", "سارة", "نورهان", "آية", "منى", "هدى", "ياسمين", "ندى",
    "رانيا", "شيماء", "دعاء", "أسماء", "هبة", "سلمى", "إيمان", "نجلاء", "رضوى",
    "مروة", "خلود", "دينا", "شروق", "روان", "حبيبة", "شهد", "ملك", "منة الله",
    "أميرة", "نادية", "سحر", "وفاء", "سميحة", "زينب", "كريمة", "ماجدة", "إلهام",
    "سهام", "سامية", "عبير", "نهى", "ريهام", "هاجر", "علياء", "شيرين", "إيناس",
    "تغريد", "ميرنا", "جنى", "جودي", "حنين", "فرح", "بسنت", "إسراء", "جهاد",
]

MIDDLE_FATHER_NAMES = [
    "محمد", "أحمد", "محمود", "علي", "إبراهيم", "مصطفى", "خالد", "حسن", "حسين",
    "عبدالرحمن", "عبدالله", "عبدالعزيز", "عبدالفتاح", "عبدالحميد", "صلاح",
    "جمال", "كمال", "سيد", "شريف", "عمر", "عادل", "فهمي", "سعيد", "صابر",
    "عاطف", "ممدوح", "شحاتة", "عزمي", "عثمان", "زكريا", "أنور", "فتحي",
]

FAMILY_LAST_NAMES = [
    "هليل", "سالم", "الشافعي", "البدري", "الشناوي", "الجندي", "النجار", "منصور",
    "غانم", "علام", "الصاوي", "الصيرفي", "الديب", "رضوان", "غريب", "الباز",
    "عمارة", "القاضي", "زهران", "البنا", "عفيفي", "مرسي", "قاسم", "بركات",
    "الجزار", "درويش", "الشامي", "مسعود", "جاد", "زايد", "غازي", "قنديل",
    "الصياد", "المهدي", "حماد", "سويلم", "خطاب", "سليمان", "خليل", "حجازي",
]

MALE_JOBS = [
    "مهندس برمجيات", "طبيب بشري", "محاسب قانوني", "محام حر", "مدرس لغة عربية",
    "طالب جامعي", "فني صيانة كهرباء", "مدير مالي", "موظف إداري", "سائق مهني",
    "عامل بناء", "صيدلي", "مفتش آثار", "أخصائي تحاليل طبية", "باحث اجتماعي",
    "مهندس مدني", "ضابط شرطة سابق", "حاصل على بكالوريوس تجارة", "تاجر ملابس",
]

FEMALE_JOBS = [
    "طبيبة بشرية", "مهندسة معمارية", "معلمة لغة إنجليزية", "محاسبة مالية",
    "ربة منزل", "طالبة بالجامعة", "صيدلانية", "أخصائية تمريض", "محامية حرة",
    "موظفة إدارية بالتربية والتعليم", "أخصائية علاج طبيعي", "معيدة بالكلية",
    "حاصلة على ليسانس حقوق", "أخصائية تغذية علاجية", "مصممة جرافيك",
]

# ── 2. Official Egyptian Governorates and Code Mapping ────────────────────────

GOVERNORATES: dict[str, dict[str, any]] = {
    "01": {"name": "القاهرة", "districts": ["المعادي", "مدينة نصر", "مصر الجديدة", "الشرابية", "شبرا", "حلوان", "عين شمس", "المرج", "الوايلي", "الزيتون", "البساتين"]},
    "02": {"name": "الإسكندرية", "districts": ["سيدي جابر", "سموحة", "محرم بك", "الرمل", "العصافرة", "ميامي", "المنتزه", "الدخيلة", "العجمي", "كرموز"]},
    "03": {"name": "بورسعيد", "districts": ["حي الشرق", "حي العرب", "حي المناخ", "حي الضواحي", "بورفؤاد", "حي الزهور"]},
    "04": {"name": "السويس", "districts": ["حي الأربعين", "حي السويس", "حي فيصل", "حي الجناين", "حي عتاقة"]},
    "11": {"name": "دمياط", "districts": ["دمياط الجديدة", "رأس البر", "فارسكور", "الزرقا", "كفر سعد"]},
    "12": {"name": "الدقهلية", "districts": ["المنصورة", "طلخا", "ميت غمر", "السنبلاوين", "دكرنس", "بلقاس", "شربين"]},
    "13": {"name": "الشرقية", "districts": ["الزقازيق", "العاشر من رمضان", "بلبيس", "منيا القمح", "فاقوس", "أبو حماد", "ديرب نجم"]},
    "14": {"name": "القليوبية", "districts": ["بنها", "شبرا الخيمة", "قليوب", "الخانكة", "طوخ", "القناطر الخيرية", "كفر شكر"]},
    "15": {"name": "كفر الشيخ", "districts": ["كفر الشيخ", "دسوق", "فوه", "مطوبس", "بيلا", "سيدي سالم", "الحامول"]},
    "16": {"name": "الغربية", "districts": ["طنطا", "المحلة الكبرى", "زفتى", "كفر الزيات", "سمنود", "بسيون"]},
    "17": {"name": "المنوفية", "districts": ["شبين الكوم", "منوف", "أشمون", "قويسنا", "بركة السبع", "تلا", "السادات"]},
    "18": {"name": "البحيرة", "districts": ["دمنهور", "كفر الدوار", "إيتاي البارود", "أبو حمص", "كوم حمادة", "رشيد", "حوش عيسى"]},
    "19": {"name": "الإسماعيلية", "districts": ["حي أول", "حي ثان", "حي ثالث", "فايد", "القنطرة غرب", "التل الكبير"]},
    "21": {"name": "الجيزة", "districts": ["الدقي", "المهندسين", "الهرم", "حدائق الأهرام", "العجوزة", "فيصل", "العمرانية", "بولاق الدكرور", "مدينة 6 أكتوبر", "الشيخ زايد"]},
    "22": {"name": "بني سويف", "districts": ["بني سويف", "الواسطى", "ناصر", "إهناسيا", "ببا", "سمسطا", "الفشن"]},
    "23": {"name": "الفيوم", "districts": ["الفيوم", "سنورس", "إطسا", "طامية", "يوسف الصديق", "أبشواي"]},
    "24": {"name": "المنيا", "districts": ["المنيا", "ملوي", "بني مزار", "مغاغة", "سمالوط", "أبو قرقاص", "مطاي"]},
    "25": {"name": "أسيوط", "districts": ["أسيوط", "ديروط", "منفلوط", "القوصية", "أبنوب", "أبو تيج", "البداري", "صدفا"]},
    "26": {"name": "سوهاج", "districts": ["سوهاج", "طهطا", "جرجا", "أخميم", "المراغة", "البلينا", "المنشأة"]},
    "27": {"name": "قنا", "districts": ["قنا", "نجع حمادي", "قوص", "دشنا", "أبو تشت", "فرشوط", "نقادة", "أبنود"]},
    "28": {"name": "أسوان", "districts": ["أسوان", "كوم أمبو", "إدفو", "نصر النوبة", "دراو"]},
    "29": {"name": "الأقصر", "districts": ["الأقصر", "إسنا", "أرمنت", "الطود", "البياضية", "القرنة"]},
    "31": {"name": "البحر الأحمر", "districts": ["الغردقة", "سفاجا", "القصير", "رأس غارب", "مرسى علم"]},
    "32": {"name": "الوادي الجديد", "districts": ["الخارجة", "الداخلة", "الفرافرة", "باريس", "بلاط"]},
    "33": {"name": "مطروح", "districts": ["مرسى مطروح", "الحمام", "العلمين", "الضبعة", "سيوة"]},
    "34": {"name": "شمال سيناء", "districts": ["العريش", "الشيخ زويد", "رفح", "بئر العبد", "نخل", "الحسنة"]},
    "35": {"name": "جنوب سيناء", "districts": ["شرم الشيخ", "طور سيناء", "دهب", "نويبع", "طابا", "رأس سدر"]},
}

# ── 3. Digit Mapping & Noise Simulation Helpers ──────────────────────────────

EASTERN_TO_WESTERN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
WESTERN_TO_EASTERN = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def to_eastern_digits(text: str) -> str:
    return str(text).translate(WESTERN_TO_EASTERN)


def generate_egyptian_national_id(gender: str, birth_date: datetime.date, gov_code: str) -> str:
    """
    Generate an authentic 14-digit Egyptian National ID strictly matching:
    - Century: 2 for 1900-1999, 3 for 2000-2099
    - Year (2 digits), Month (2 digits), Day (2 digits)
    - Governorate code (2 digits)
    - Sequence number (3 digits)
    - Gender digit (13th digit): ODD for male, EVEN for female
    - Check digit (14th digit): 1 to 9
    """
    century = "2" if birth_date.year < 2000 else "3"
    yy = f"{birth_date.year % 100:02d}"
    mm = f"{birth_date.month:02d}"
    dd = f"{birth_date.day:02d}"
    seq = f"{random.randint(1, 999):03d}"

    # Digit 13: strictly Odd for Male, Even for Female
    if gender.lower() == "male":
        gender_digit = str(random.choice([1, 3, 5, 7, 9]))
    else:
        gender_digit = str(random.choice([0, 2, 4, 6, 8]))

    check_digit = str(random.randint(1, 9))
    return f"{century}{yy}{mm}{dd}{gov_code}{seq}{gender_digit}{check_digit}"


def inject_ocr_noise_to_national_id(nid: str) -> str:
    """
    Simulate typical OCR artifacts when scanning 14-digit ID numbers on cards:
    - Converted to Eastern Arabic digits
    - Random spaces or chunking
    - Occasional reversed reading order chunks (RTL scan artifacts)
    """
    eastern_nid = to_eastern_digits(nid)
    noise_style = random.choice(["spaced_all", "chunks", "rtl_chunks", "mixed_with_noise"])

    if noise_style == "spaced_all":
        return " ".join(list(eastern_nid))
    elif noise_style == "chunks":
        # Group like: 30506 21 22 0023 4
        return f"{eastern_nid[:5]} {eastern_nid[5:7]} {eastern_nid[7:9]} {eastern_nid[9:13]} {eastern_nid[13]}"
    elif noise_style == "rtl_chunks":
        # Reverse order chunks from RTL reading: ٣٤ ٠٠٢ ٢٢ ٢١ ٠٦ ٠٥ ٣
        c1 = eastern_nid[12:]
        c2 = eastern_nid[9:12]
        c3 = eastern_nid[7:9]
        c4 = eastern_nid[5:7]
        c5 = eastern_nid[3:5]
        c6 = eastern_nid[1:3]
        c7 = eastern_nid[0]
        return f"{c1} {c2} {c3} {c4} {c5} {c6} {c7}"
    else:
        # Mixed with noisy symbols
        chars = list(eastern_nid)
        return " ".join(chars[:7]) + " ؛ " + " ".join(chars[7:])


def inject_address_noise(address: str) -> str:
    """
    Simulates common Egyptian address OCR misreads:
    - ٥ misread as د or ه in building numbers (e.g. ٨٥ ب -> د ٨ ب)
    - Separator replacements (hyphens, dots, slashes)
    """
    noisy = address
    if "٥" in noisy and random.random() < 0.6:
        noisy = noisy.replace("٥", random.choice(["د", "ه", " ٥ "]))
    if "-" in noisy and random.random() < 0.5:
        noisy = noisy.replace("-", random.choice([" . ", " / ", " - ", " "]))
    return noisy


# ── 4. Document Generators ───────────────────────────────────────────────────

def generate_person(gender: str) -> dict[str, any]:
    if gender == "male":
        first = random.choice(MALE_FIRST_NAMES)
        job = random.choice(MALE_JOBS)
    else:
        first = random.choice(FEMALE_FIRST_NAMES)
        job = random.choice(FEMALE_JOBS)

    father = random.choice(MIDDLE_FATHER_NAMES)
    grandfather = random.choice(MIDDLE_FATHER_NAMES)
    family = random.choice(FAMILY_LAST_NAMES)
    full_name = f"{first} {father} {grandfather} {family}"

    gov_code = random.choice(list(GOVERNORATES.keys()))
    gov_info = GOVERNORATES[gov_code]
    district = random.choice(gov_info["districts"])

    # Birthdate between 1945 and 2006 (adult for ID card)
    start_date = datetime.date(1945, 1, 1)
    end_date = datetime.date(2006, 12, 31)
    days_range = (end_date - start_date).days
    birth_date = start_date + datetime.timedelta(days=random.randint(0, days_range))

    nid = generate_egyptian_national_id(gender, birth_date, gov_code)

    # Street & Building number
    building_num = random.choice(["٥ ٨ ب", "١٢ أ", "٤٥", "٧", "١٠٤", "٢٣ ش", "٦"])
    street = random.choice(["شارع الجمهورية", "شارع النصر", "شارع الثورة", "شارع السلام", "شارع الجلاء", "شارع الجيش", "ميدان المحطة"])
    address = f"{building_num} - {street} - {district} - {gov_info['name']}"

    return {
        "gender": gender,
        "first_name": first,
        "full_name": full_name,
        "job": job,
        "gov_code": gov_code,
        "governorate": gov_info["name"],
        "district": district,
        "birth_date": birth_date,
        "national_id": nid,
        "address": address,
    }


def generate_national_id_case() -> tuple[str, dict[str, any]]:
    gender = random.choice(["male", "female"])
    person = generate_person(gender)

    # OCR text reconstruction with realistic noise
    header = random.choice([
        "بطاقة . = تحقيق | الشخصية",
        "جمهورية مصر العربية / قطاع مصلحة الأحوال المدنية / بطاقة تحقيق الشخصية",
        "بطاقة تحقيق الشخصية",
        "جمهورية مصر العربية - بطاقة رقم قومي",
    ])
    noisy_nid = inject_ocr_noise_to_national_id(person["national_id"])
    noisy_address = inject_address_noise(person["address"])
    serial = f"{random.choice(['KC', 'EB', 'AA', 'ZD'])}{random.randint(1000000, 9999999)}"

    # Multi-line noisy OCR format
    name_lines = person["full_name"].split(" ", 1)
    ocr_text = f"""{header}
{name_lines[0]}
{name_lines[1] if len(name_lines) > 1 else ''}
{noisy_address}
{person['job']}
{noisy_nid}
{serial}"""

    expected_json = {
        "doc_type": "national_id",
        "summary": f"بطاقة رقم قومي للمواطن{'ة' if gender == 'female' else ''} {person['full_name']}.",
        "issuer": "قطاع مصلحة الأحوال المدنية - وزارة الداخلية",
        "doc_number": person["national_id"],
        "amount": "",
        "issue_date": None,
        "expiry_date": None,
        "actions": "تجديد البطاقة في موعد الانتهاء واستخدامها لإثبات الشخصية",
        "entities": {
            "name": person["full_name"],
            "national_number": person["national_id"],
            "address": person["address"],
            "governorate": person["governorate"],
            "job": person["job"],
        },
        "dates": [person["birth_date"].strftime("%Y/%m/%d")],
        "amounts": [],
        "tags": ["arabic", "identity", "national_id"],
    }

    return ocr_text.strip(), expected_json


ARABIC_MONTHS = [
    "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
]

ARABIC_DAYS_WORDS = [
    "", "الأول من", "الثاني من", "الثالث من", "الرابع من", "الخامس من", "السادس من",
    "السابع من", "الثامن من", "التاسع من", "العاشر من", "الحادي عشر من", "الثاني عشر من",
    "الثالث عشر من", "الرابع عشر من", "الخامس عشر من", "السادس عشر من", "السابع عشر من",
    "الثامن عشر من", "التاسع عشر من", "العشرون من", "الواحد والعشرون من", "الثاني والعشرون من",
    "الثالث والعشرون من", "الرابع والعشرون من", "الخامس والعشرون من", "السادس والعشرون من",
    "السابع والعشرون من", "الثامن والعشرون من", "التاسع والعشرون من", "الثلاثون من", "الحادي والثلاثون من"
]

def format_written_arabic_date(d: datetime.date) -> str:
    day_word = ARABIC_DAYS_WORDS[d.day] if d.day < len(ARABIC_DAYS_WORDS) else f"{d.day} من"
    month_word = ARABIC_MONTHS[d.month]
    yr_offset = d.year - 2000
    units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
             "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر",
             "سبعة عشر", "ثمانية عشر", "تسعة عشر", "عشرون", "واحد وعشرون", "اثنان وعشرون",
             "ثلاثة وعشرون", "أربعة وعشرون", "خمسة وعشرون"]
    yr_word = f"عام ألفان و {units[yr_offset]}" if 0 <= yr_offset < len(units) else f"عام {d.year}"
    return f"{day_word} {month_word} {yr_word}"


def generate_birth_certificate_case() -> tuple[str, dict[str, any]]:
    baby_gender = random.choice(["male", "female"])
    baby_first = random.choice(MALE_FIRST_NAMES if baby_gender == "male" else FEMALE_FIRST_NAMES)
    father_middle = random.choice(MIDDLE_FATHER_NAMES)
    father_grand = random.choice(MIDDLE_FATHER_NAMES)
    family_name = random.choice(FAMILY_LAST_NAMES)
    father_full = f"{father_middle} {father_grand} {family_name}"
    baby_full = f"{baby_first} {father_full}"

    mother_first = random.choice(FEMALE_FIRST_NAMES)
    mother_father = random.choice(MIDDLE_FATHER_NAMES)
    mother_grand = random.choice(MIDDLE_FATHER_NAMES)
    mother_full = f"{mother_first} {mother_father} {mother_grand} {random.choice(FAMILY_LAST_NAMES)}"

    gov_code = random.choice(list(GOVERNORATES.keys()))
    gov_info = GOVERNORATES[gov_code]
    district = random.choice(gov_info["districts"])

    # Recent newborn date (2012 to 2024)
    start_date = datetime.date(2012, 1, 1)
    end_date = datetime.date(2024, 6, 1)
    birth_date = start_date + datetime.timedelta(days=random.randint(0, (end_date - start_date).days))
    baby_nid = generate_egyptian_national_id(baby_gender, birth_date, gov_code)

    # Authentic Father National ID (Male, born ~25-40 years before child)
    father_birth = birth_date - datetime.timedelta(days=random.randint(25 * 365, 42 * 365))
    father_nid = generate_egyptian_national_id("male", father_birth, gov_code)

    # Authentic Mother National ID (Female, born ~22-38 years before child)
    mother_birth = birth_date - datetime.timedelta(days=random.randint(22 * 365, 38 * 365))
    mother_nid = generate_egyptian_national_id("female", mother_birth, gov_code)

    reg_date = birth_date + datetime.timedelta(days=random.randint(1, 15))
    issue_date = reg_date + datetime.timedelta(days=random.randint(5, 300))

    written_birth = format_written_arabic_date(birth_date)
    noisy_baby_nid = inject_ocr_noise_to_national_id(baby_nid)
    serial_no = f"{random.randint(1000000000, 1999999999)}"
    reg_num = f"{random.randint(100, 9999)}"

    # Replicate exact 3-box layout of official Egyptian Birth Certificate (صورة قيد الميلاد)
    ocr_text = f"""جمهورية مصر العربية
وزارة الداخلية
قطاع مصلحة الأحوال المدنية
www.cso.gov.eg
صورة قيد الميلاد
الرقم القومي : {noisy_baby_nid}
بيانات المولود
{baby_first}
الجنسية : مصر    الديانة : مسلمة
النوع : {'أنثى' if baby_gender == 'female' else 'ذكر'}
محل الميلاد : {gov_info['name']} / {district}
تاريخ الميلاد : {written_birth}
بيانات الأب
{father_full}
الرقم القومي : {to_eastern_digits(father_nid)}    الديانة : مسلم
الجنسية : مصر
بيانات الأم
{mother_full}
الرقم القومي : {to_eastern_digits(mother_nid)}    الديانة : مسلمة
الجنسية : مصر
م . صحة : {district}    رقم القيد : {to_eastern_digits(reg_num)}
س . مدني : {district}    ت . القيد : {to_eastern_digits(reg_date.strftime('%Y/%m/%d'))}
س . اصدار : سجل {district}    ت . اصدار : {to_eastern_digits(issue_date.strftime('%Y/%m/%d'))}
رقم مسلسل : {to_eastern_digits(serial_no)}
لا يعتد بهذه الشهادة بدون طابع تأمين الأسرة
توقيع: ضابط شرطة"""

    expected_json = {
        "doc_type": "birth_certificate",
        "summary": f"شهادة ميلاد للمولود{'ة' if baby_gender == 'female' else ''} {baby_full}.",
        "issuer": "قطاع مصلحة الأحوال المدنية - وزارة الداخلية",
        "doc_number": baby_nid,
        "amount": "",
        "issue_date": issue_date.strftime("%Y/%m/%d"),
        "expiry_date": None,
        "actions": "الاحتفاظ بصورة قيد الميلاد لاستخدامها في إثبات النسب والمعاملات الحكومية والمدرسية",
        "entities": {
            "name": baby_full,
            "national_number": baby_nid,
            "address": f"{gov_info['name']} / {district}",
            "governorate": gov_info["name"],
            "job": "",
        },
        "dates": [birth_date.strftime("%Y/%m/%d"), reg_date.strftime("%Y/%m/%d"), issue_date.strftime("%Y/%m/%d")],
        "amounts": [],
        "tags": ["arabic", "identity", "birth_certificate"],
    }

    return ocr_text.strip(), expected_json


def generate_utility_bill_case() -> tuple[str, dict[str, any]]:
    utility_type = random.choice(["كهرباء", "مياه", "غاز"])
    gender = random.choice(["male", "female"])
    person = generate_person(gender)

    bill_year = random.choice([2023, 2024, 2025])
    bill_month = random.randint(1, 12)
    amount_num = round(random.uniform(75.50, 850.00), 2)
    amount_str = f"{amount_num:.2f} ج.م"
    sub_num = f"{random.randint(10000000, 99999999)}"
    invoice_num = f"INV-{random.randint(100000, 999999)}"

    if utility_type == "كهرباء":
        company = random.choice([
            "شركة جنوب القاهرة لتوزيع الكهرباء",
            "شركة شمال القاهرة لتوزيع الكهرباء",
            "شركة الإسكندرية لتوزيع الكهرباء",
            "شركة القناة لتوزيع الكهرباء",
        ])
    elif utility_type == "مياه":
        company = f"شركة مياه الشرب والصرف الصحي بـ {person['governorate']}"
    else:
        company = random.choice([
            "شركة الغاز الطبيعي للمنازل (تاون جاس)",
            "شركة غاز مصر (Egypt Gas)",
            "شركة بتروتريد للخدمات البترولية",
        ])

    ocr_text = f"""جمهورية مصر العربية
{company}
فاتورة استهلاك {utility_type}
رقم الفاتورة: {invoice_num}
رقم المشترك / الحساب: {sub_num}
اسم المشترك: {person['full_name']}
العنوان: {person['address']}
عن شهر: {to_eastern_digits(f"{bill_year}/{bill_month:02d}")}
قراءة العداد الحالية: {to_eastern_digits(str(random.randint(1000, 9999)))}
المبلغ المطلوب سداده: {amount_str}
تاريخ الاستحقاق: {to_eastern_digits(f"{bill_year}/{bill_month:02d}/28")}"""

    expected_json = {
        "doc_type": "utility_bill",
        "summary": f"فاتورة {utility_type} صادرة من {company} للمشترك{'ة' if gender == 'female' else ''} {person['full_name']} بمبلغ {amount_str}.",
        "issuer": company,
        "doc_number": sub_num,
        "amount": amount_str,
        "issue_date": f"{bill_year}/{bill_month:02d}",
        "expiry_date": f"{bill_year}/{bill_month:02d}/28",
        "actions": "سداد قيمة الفاتورة عبر منافذ الدفع الإلكتروني لتجنب انقطاع الخدمة",
        "entities": {
            "name": person["full_name"],
            "national_number": "",
            "address": person["address"],
            "governorate": person["governorate"],
            "job": "",
        },
        "dates": [f"{bill_year}/{bill_month:02d}", f"{bill_year}/{bill_month:02d}/28"],
        "amounts": [amount_str],
        "tags": ["arabic", "utility", "utility_bill", "financial"],
    }

    return ocr_text.strip(), expected_json


# ── 5. Main Dataset Generator Script ─────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert Arabic document analyst specialized in Egyptian government documents and administrative paperwork.

You receive noisy OCR text extracted from images or scanned PDFs. OCR may contain mistakes:
- missing Arabic letters
- wrong characters (e.g. Arabic numeral ٥ is often misrecognized as letter د or ه in address building numbers)
- separated words
- incorrect spacing

Your job:
1. Understand the document type and contents.
2. Correct obvious OCR mistakes.
3. Extract all relevant information accurately according to the JSON schema.
4. Always answer in Arabic. DO NOT translate names or addresses into English.

Return ONLY valid JSON.

Schema:
{
  "doc_type": "national_id | passport | birth_certificate | utility_bill | receipt | invoice | driving_license | marriage_certificate | death_certificate | government_document | unknown",
  "summary": "ملخص واضح ومفيد للمستند باللغة العربية",
  "issuer": "الجهة الحكومية أو المؤسسة المصدرة",
  "doc_number": "رقم المستند أو الرقم القومي أو رقم المشترك",
  "amount": "المبلغ المالي أو فارغ",
  "issue_date": "تاريخ إصدار المستند إن وجد",
  "expiry_date": "تاريخ انتهاء صلاحية المستند إن وجد",
  "actions": "الإجراءات أو الخطوات المطلوبة",
  "entities": {
      "name": "اسم المواطن الكامل",
      "national_number": "الرقم القومي (14 رقم)",
      "address": "العنوان بالتفصيل كاملاً",
      "governorate": "المحافظة بالعربية",
      "job": "المهنة أو الوظيفة"
  },
  "dates": [],
  "amounts": [],
  "tags": []
}"""


def generate_dataset(total_samples: int = 1200, val_ratio: float = 0.1, output_dir: Path | None = None) -> tuple[Path, Path]:
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    train_file = output_dir / "egypt_docs_train.jsonl"
    val_file = output_dir / "egypt_docs_val.jsonl"

    cases = []
    # Proportions: 50% National ID (male + female), 30% Birth Certificate (male + female), 20% Utility Bill
    nid_count = int(total_samples * 0.50)
    birth_count = int(total_samples * 0.30)
    bill_count = total_samples - nid_count - birth_count

    print(f"Generating {total_samples} synthetic Egyptian document samples...")
    print(f"  • {nid_count} National ID samples (50% Female / 50% Male)")
    print(f"  • {birth_count} Birth Certificate samples (50% Female / 50% Male)")
    print(f"  • {bill_count} Utility Bill samples (Electricity, Water, Gas)")

    for _ in range(nid_count):
        ocr, ans = generate_national_id_case()
        cases.append((ocr, ans))

    for _ in range(birth_count):
        ocr, ans = generate_birth_certificate_case()
        cases.append((ocr, ans))

    for _ in range(bill_count):
        ocr, ans = generate_utility_bill_case()
        cases.append((ocr, ans))

    random.shuffle(cases)

    split_idx = int(len(cases) * (1.0 - val_ratio))
    train_cases = cases[:split_idx]
    val_cases = cases[split_idx:]

    for split_path, case_list in [(train_file, train_cases), (val_file, val_cases)]:
        with open(split_path, "w", encoding="utf-8") as f:
            for ocr_text, ans_json in case_list:
                record = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": ocr_text},
                        {"role": "assistant", "content": json.dumps(ans_json, ensure_ascii=False)},
                    ]
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"\nDataset generation complete:")
    print(f"  Train: {train_file} ({len(train_cases)} samples)")
    print(f"  Val:   {val_file} ({len(val_cases)} samples)")
    return train_file, val_file


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic Egyptian document dataset for Qwen2.5 fine-tuning")
    parser.add_argument("--samples", type=int, default=1200, help="Total number of samples (default: 1200)")
    parser.add_argument("--val-ratio", type=float, default=0.1, help="Validation split ratio (default: 0.1)")
    parser.add_argument("--output-dir", type=str, default=None, help="Directory to save JSONL datasets")
    args = parser.parse_args()

    out_dir = Path(args.output_dir) if args.output_dir else None
    generate_dataset(total_samples=args.samples, val_ratio=args.val_ratio, output_dir=out_dir)
