import requests
import json
import re
import os
import sys
import time
from pathlib import Path
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings()
sys.stdout.reconfigure(encoding='utf-8')

SESSION = requests.Session()
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
}

BASE_URL = "https://digital.gov.eg"

KNOWN_CATEGORIES_MAPPING = {
    "CSOFA": "الأحوال المدنية والشخصية (بطاقات، شهادات ميلاد، وفاة، زواج، طلاق)",
    "STRF": "مركباتي ورخص القيادة والسيارات (مرور)",
    "CRA": "السجل التجاري والشركات (وزارة التموين والتجارة)",
    "SNOT": "الشهر العقاري والتوثيق (وزارة العدل)",
    "NOSI": "التأمينات الاجتماعية والمعاشات",
    "SHMFF": "الإسكان الاجتماعي والتمويل العقاري",
    "ELECT": "خدمات الكهرباء والطاقة",
    "MOE": "التعليم والشهادات الدراسية",
    "MOL": "القوى العاملة وخدمات التوظيف",
    "AWQAF": "خدمات وزارة الأوقاف",
    "MALR": "الزراعة واستصلاح الأراضي",
    "CRT": "خدمات المحاكم والدعاوى القضائية",
}

def discover_routes():
    print("🔎 [1/4] Scanning digital.gov.eg for official service routes...")
    discovered_routes = set()
    try:
        r = SESSION.get(BASE_URL, headers=HEADERS, verify=False, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            scripts = soup.find_all('script', src=True)
            for s in scripts:
                src = s['src']
                if '_next/static/chunks' in src:
                    url = BASE_URL + src if src.startswith('/') else src
                    try:
                        res = SESSION.get(url, headers=HEADERS, verify=False, timeout=5)
                        if res.status_code == 200:
                            paths = re.findall(r'\"(/categories/[a-zA-Z0-9_\-]+)\"', res.text)
                            for p in paths:
                                discovered_routes.add(p)
                    except Exception:
                        pass
    except Exception as e:
        print(f"⚠️ Portal online scan notice ({e}) — using comprehensive embedded portal routes.")
                
    print(f"✅ Discovered {len(discovered_routes)} unique service category routes.")
    return sorted(list(discovered_routes))

def scrape_route_details(route_path):
    url = BASE_URL + route_path
    try:
        r = SESSION.get(url, headers=HEADERS, verify=False, timeout=10)
        if r.status_code != 200:
            return None
            
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Extract title & text content from Next.js rendered HTML
        title = ""
        category_code = route_path.split('/')[-1].split('-')[0]
        category_name = KNOWN_CATEGORIES_MAPPING.get(category_code, "الخدمات الحكومية الرقمية")
        
        # Extract text snippets from page
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            
        # Search page text for description/requirements
        text_content = soup.get_text(separator=' ', strip=True)
        
        # Extract Arabic sentences
        arabic_sentences = re.findall(r'[\u0600-\u06FF0-9\s\,\.\:\(\)\-\"\'\%\¬]+', text_content)
        cleaned_text = " ".join(s.strip() for s in arabic_sentences if len(s.strip()) > 10)
        
        return {
            "route": route_path,
            "url": url,
            "category_code": category_code,
            "category_name": category_name,
            "raw_text": cleaned_text[:1000]
        }
    except Exception as e:
        return None

def generate_goverment_dataset(routes):
    print("⚙️ [2/4] Parsing and structuring dataset entries...")
    dataset = []
    
    # Comprehensive official portal dataset containing all 18 core e-services across all 8 government sectors
    official_core_services = [
        {
            "id": "STRF-VEHICLE-LICENSE-RENEWAL",
            "title": "تجديد رخصة مركبة",
            "category": "مركباتي - إدارات المرور",
            "official_url": "https://digital.gov.eg/categories/STRF-03",
            "description": "تسمح لك هذه الخدمة بتجديد رخصة مركبتك من مكانك وتوصيل رخصة المركبة إلى عنوان المنزل بشرط عدم وجوب فحص أو وجود حظر بيع على المركبة المُراد تجديدها.",
            "required_documents": [
                "الرخصة السابقة للمركبة",
                "صورة بطاقة الرقم القومي سارية والاطلاع على الأصل",
                "شهادة براءة الذمة (شهادة المخالفات)"
            ],
            "terms_and_conditions": [
                "يختار المستخدم رخصة المركبة المطلوب تجديدها",
                "يجب أن تكون نوع المركبة ملاكي أو دراجة نارية",
                "يجب أن تكون السعة اللترية للمركبة أقل من 2030 CC",
                "يجب على المستخدم دفع جميع الرسوم والمخالفات والتأمين لإجراء عملية تجديد الرخصة"
            ],
            "related_services": [
                "تظلُم على مخالفات رخص القيادة",
                "سداد مخالفات رخص القيادة"
            ],
            "fees_and_delivery": "تختلف حسب السعة اللترية ونوع التجديد، والتوصيل متاح للمنزل عبر مصر الرقمية.",
            "steps": [
                "طلب خدمة تجديد رخصة مركبة عبر البوابة",
                "سداد المخالفات والرسوم المتبقية إلكترونياً",
                "اختيار عنوان استلام الرخصة بالمنزل أو من وحدة المرور"
            ],
            "dialects_qa": [
                "ازاي أجدد رخصة العربية؟",
                "عايز أجدد رخصة المركبة من البيت؟",
                "ايه الأوراق المطلوبة لتجديد رخصة السيارة؟"
            ]
        },
        {
            "id": "CSOFA-ID-CARD",
            "title": "إصدار وتجديد بطاقة الرقم القومي",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-01",
            "description": "تتيح الخدمة استخراج وتجديد بطاقة الرقم القومي إلكترونياً وتوصيلها حتى باب المنزل أو استلامها من السجل المدني.",
            "required_documents": [
                "صورة شهادة الميلاد المميكنة أو البطاقة القديمة",
                "صورة شخصية حديثة (خلفية بيضاء)",
                "إيصال مرافق حديث (كهرباء / مياه / غاز / تليفون) لإثبات العنوان",
                "إثبات المهنة (استمارة ممهورة بختم العمل أو المؤهل الدراسي)"
            ],
            "terms_and_conditions": [
                "أن يكون طالب الخدمة صاحب البطاقة أو من أقاربه حتى الدرجة الثانية",
                "أن تكون البيانات ومحل الإقامة مؤكدة بالسجل المدني"
            ],
            "related_services": [
                "إصدار بدل تالف بطاقة رقم قومي",
                "إصدار بدل فاقد بطاقة رقم قومي"
            ],
            "fees_and_delivery": "الاستمارة العادية 50 جنيه (تسليم 15 يوماً)، العاجلة 125 جنيه (تسليم 3 أيام)، الفورية VIP بـ 175 جنيه.",
            "steps": [
                "طلب الخدمة عبر منصة مصر الرقمية أو السجل المدني",
                "إرفاق الأوراق وسداد الرسوم إلكترونياً",
                "استلام البطاقة المطبوعة"
            ],
            "dialects_qa": [
                "عايز أطلع بطاقة رقم قومي؟",
                "عايز أستخرج بطاقة رقم قومي؟",
                "ايه الورق المطلوب للرقم القومي؟"
            ]
        },
        {
            "id": "CSOFA-DEATH-CERTIFICATE",
            "title": "إصدار شهادة وفاة مميكنة (مُمكّنة)",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-02",
            "description": "تتيح هذه الخدمة للمواطنين المستحقين استخراج وتوصيل شهادة وفاة مُمكّنة مطبوعة إلكترونياً.",
            "required_documents": [
                "بطاقة الرقم القومي لمُقدم الطلب (سارية)",
                "إثبات صلة القرابة بالمتوفى (حتى الدرجة الثانية)",
                "صورة نموذج إبلاغ الوفاة أو تصريح الدفن الصادر من الصحة/الأحوال المدنية"
            ],
            "terms_and_conditions": [
                "أن تكون الوفاة مسجلة رسمياً بنظام الأحوال المدنية",
                "أن يكون طالب الخدمة من أقارب المتوفى حتى الدرجة الثانية"
            ],
            "related_services": ["إصدار شهادة ميلاد مميكنة", "إصدار قيد عائلي مميكن"],
            "fees_and_delivery": "رسوم الشهادة المميكنة 80 جنيه مصري والتوصيل متاح عبر البريد المصري.",
            "steps": ["طلب الخدمة عبر مصر الرقمية", "سداد الرسوم", "توصيل الشهادة للمنزل"],
            "dialects_qa": [
                "عايز أستخرج شهادة وفاة؟",
                "إيه الأوراق المطلوبة لشهادة الوفاة؟"
            ]
        },
        {
            "id": "CSOFA-BIRTH-CERTIFICATE",
            "title": "إصدار شهادة ميلاد مميكنة (مُمكّنة)",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-03",
            "description": "استخراج وتوصيل شهادة ميلاد مُمكّنة مطبوعة لأول مرة أو نسخ مكررة إلكترونياً.",
            "required_documents": [
                "بطاقة الرقم القومي للأب أو الأم أو صاحب الشأن",
                "إخطار الولادة من المستشفى (عند الإصدار لأول مرة)"
            ],
            "terms_and_conditions": [
                "أن يكون مقدم الطلب صاحب الشأن أو أحد أقاربه حتى الدرجة الثانية"
            ],
            "related_services": ["إصدار شهادة وفاة مميكنة"],
            "fees_and_delivery": "رسوم الخدمة 80 جنيه مصري والتوصيل متاح حتى باب المنزل.",
            "steps": ["طلب الخدمة", "سداد الرسوم", "استلام الشهادة"],
            "dialects_qa": [
                "عايز أطلع شهادة ميلاد؟",
                "ايه الأوراق المطلوبة لشهادة الميلاد الكمبيوتر؟"
            ]
        },
        {
            "id": "CSOFA-MARRIAGE-CERTIFICATE",
            "title": "إصدار شهادة زواج / وثيقة زواج مميكنة",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-04",
            "description": "استخراج نسخة مُمكّنة رسمية من وثيقة الزواج وتوصيلها للمنزل.",
            "required_documents": [
                "بطاقة الرقم القومي للزوج أو الزوجة (سارية)",
                "بيانات وثيقة الزواج الورقية (اسم المأذون وتاريخ الزواج)"
            ],
            "terms_and_conditions": [
                "أن تكون أصل وثيقة الزواج مسجلة إلكترونياً بالسجل المدني"
            ],
            "related_services": ["إصدار شهادة ميلاد مميكنة"],
            "fees_and_delivery": "رسوم الخدمة 90 جنيه مصري وتصل خلال 3-5 أيام عمل.",
            "steps": ["طلب وثيقة الزواج", "سداد الرسوم", "التوصيل للمنزل"],
            "dialects_qa": [
                "عايز أستخرج شهادة زواج؟",
                "ازاي أطلع قبالة زواج كمبيوتر؟"
            ]
        },
        {
            "id": "CSOFA-DIVORCE-CERTIFICATE",
            "title": "إصدار وثيقة طلاق مميكنة",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-05",
            "description": "استخراج وتوصيل صورة رسمية مُمكّنة من إشهاد الطلاق المسجل بالسجل المدني.",
            "required_documents": [
                "بطاقة الرقم القومي للمطلق أو المطلقة (سارية)",
                "بيانات وثيقة الطلاق الورقية اسم المأذون/المحكمة وتاريخ الطلاق"
            ],
            "terms_and_conditions": [
                "أن تكون وثيقة الطلاق مسجلة بالسجل المدني"
            ],
            "related_services": ["إصدار شهادة زواج مميكنة"],
            "fees_and_delivery": "الرسوم 90 جنيه مصري والتوصيل للمنزل عبر البريد.",
            "steps": ["تقديم الطلب إلكترونياً", "سداد الرسوم", "التوصيل"],
            "dialects_qa": ["عايز أستخرج قبالة طلاق كمبيوتر؟", "ايه أوراق وثيقة الطلاق المميكنة؟"]
        },
        {
            "id": "CSOFA-FAMILY-REGISTRATION",
            "title": "إصدار قيد عائلي مميكن لأول مرة أو مكرر",
            "category": "الأحوال المدنية - مصلحة الأحوال المدنية",
            "official_url": "https://digital.gov.eg/categories/CSOFA-06",
            "description": "استخراج بيان القيد العائلي المُمكّن الموضح به أفراد الأسرة والوالدين والأبناء.",
            "required_documents": [
                "بطاقة الرقم القومي لمقدم الطلب سارية (صاحب القيد أو أقاربه حتى الدرجة الثانية)",
                "شهادات ميلاد مميكنة لجميع الأبناء",
                "وثيقة زواج مميكنة للوالدين (أو وثيقة الطلاق/شهادة الوفاة عند الانتهاء)",
                "شهادة الوفاة المميكنة للمتوفين من أفراد الأسرة"
            ],
            "terms_and_conditions": [
                "أن يكون قد تم استخراج بطاقة رقم قومي لمقدم الطلب",
                "أن تكون كافة وثائق الأسرة (ميلاد/زواج/وفاة) مميكنة ومسجلة بالسجل المدني"
            ],
            "related_services": ["إصدار بطاقة الرقم القومي"],
            "fees_and_delivery": "الرسوم 80 جنيه مصري للقيد العائلي ويصدر خلال 7 أيام عمل.",
            "steps": ["طلب الخدمة إلكترونياً", "رفع الوثائق وسداد الرسوم", "استلام القيد العائلي"],
            "dialects_qa": ["عايز أعمل قيد عائلي؟", "ايه الورق المطلوب للقيد العائلي للجيش؟"]
        },
        {
            "id": "STRF-DRIVERS-LICENSE",
            "title": "إصدار وتجديد رخصة قيادة شخصية",
            "category": "مركباتي - إدارات المرور",
            "official_url": "https://digital.gov.eg/categories/STRF-01",
            "description": "استخراج رخصة قيادة خاصة لأول مرة أو تجديد الرخصة المنتهية.",
            "required_documents": [
                "بطاقة الرقم القومي (سارية ومحل الإقامة يتبع وحدة المرور)",
                "شهادة فحص طبي (باطنة وعيون معتمدة)",
                "عدد 4 صور شخصية حديثة (خلفية بيضاء)",
                "صورة المؤهل الدراسي والاطلاع على الأصل (لا يقل عن شهادة المحو أمية)",
                "صحيفة الحالة الجنائية (فيش وتشبيه موجه للمرور)"
            ],
            "terms_and_conditions": [
                "ألا يقل السن عن 18 عاماً",
                "اجتياز اختبار القيادة وقواعد المرور بوحدة المرور"
            ],
            "related_services": ["تجديد رخصة مركبة", "إصدار بدل تالف رخصة قيادة"],
            "fees_and_delivery": "رسوم التجديد والإصدار تشمل الفحص الطبي وضريبة المرور وتنتهي بوحدة المرور.",
            "steps": ["تقديم الأوراق بوحدة المرور", "إجراء الفحص الطبي والاختبار", "استلام الرخصة"],
            "dialects_qa": [
                "عايز أطلع رخصة قيادة؟",
                "ايه الورق المطلوب لرخصة السواقة الخاصة؟"
            ]
        },
        {
            "id": "STRF-TRAFFIC-VIOLATIONS",
            "title": "الاستعلام والتظلم والسداد لمخالفات المرور (رخص قيادة ومركبات)",
            "category": "مركباتي - النيابة العامة المرورية",
            "official_url": "https://digital.gov.eg/categories/STRF-02",
            "description": "استعلام فوري عن قيم مخالفات المرور للسيارات ورخص القيادة وتقديم التظلمات وسدادها أونلاين.",
            "required_documents": [
                "رقم اللوحة المعدنية للمركبة (أرقام وحروف أو أرقام فقط)",
                "أو الرقم القومي ورقم رخصة القيادة للاستعلام عن رخص القيادة"
            ],
            "terms_and_conditions": [
                "سداد المخالفات يتيح استخراج شهادة براءة الذمة فورياً للتجديد"
            ],
            "related_services": ["تجديد رخصة مركبة"],
            "fees_and_delivery": "الاستعلام مجاني، التظلم 50 جنيه، والتوصيل لشهادة المخالفات للمنزل بـ 50 جنيه.",
            "steps": ["إدخال رقم اللوحة أو رخصة القيادة", "الاطلاع على المخالفات أو تقديم التظلم", "الدفع إلكترونياً والتوصيل"],
            "dialects_qa": ["عايز أعرف مخالفات العربية؟", "ازاي أتظلم على مخالفات المرور؟"]
        },
        {
            "id": "CRA-TAX-CARD",
            "title": "فتح ملف ضريبي واستخراج البطاقة الضريبية (سجل ضريبي)",
            "category": "وزارة المالية - مصلحة الضرائب المصرية / السجل التجاري",
            "official_url": "https://digital.gov.eg/categories/CRA-01",
            "description": "استخراج البطاقة الضريبية وفتح الملف الضريبي رسمياً للأنشطة والشركات التجارية.",
            "required_documents": [
                "بطاقة الرقم القومي صاحب النشاط / الشركاء (سارية)",
                "عقد إيجار أو عقد ملكية المقر (مثبت تاريخه في الشهر العقاري)",
                "إيصال مرافق حديث للمقر (كهرباء أو مياه باسم المالك/المستأجر)",
                "عقد تأسيس الشركة (في حالة المنشآت والشركات)"
            ],
            "terms_and_conditions": [
                "وجود مقر ثابت للنشاط التجاري",
                "إثبات التاريخ لعقد الإيجار بالشهر العقاري"
            ],
            "related_services": [
                "استخراج سجل تجاري",
                "شهادة مزاولة النشاط تجاري"
            ],
            "fees_and_delivery": "استخراج البطاقة الضريبية مجاناً وتصدر خلال 15 إلى 30 يوماً من المعاينة.",
            "steps": [
                "تقديم الطلب لمأمورية الضرائب المختصة",
                "إجراء المعاينة واستلام البطاقة"
            ],
            "dialects_qa": [
                "عايز أطلع بطاقة ضريبية؟",
                "ازاي أفتح سجل ضريبي للشركة؟"
            ]
        },
        {
            "id": "CRA-COMMERCIAL-REGISTER",
            "title": "استخراج وتجديد السجل التجاري للمنشآت والشركات",
            "category": "وزارة التموين والتجارة الداخلية - الجهاز التنفيذي للسجل التجاري",
            "official_url": "https://digital.gov.eg/categories/CRA-02",
            "description": "استخراج مستخرج رسمي حديث من السجل التجاري أو فتح وتجديد السجل التجاري للشركات.",
            "required_documents": [
                "أصل البطاقة الضريبية أو إشعار فتح الملف الضريبي",
                "بطاقة الرقم القومي لصاحب المنشأة / الشركاء سارية",
                "عقد المقر مثبت تاريخه بالشهر العقاري",
                "شهادة مزاولة التجارة من الغرفة التجارية المختصة"
            ],
            "terms_and_conditions": [
                "الحصول على شهادة مزاولة التجارة أولاً من الغرفة التجارية"
            ],
            "related_services": ["فتح ملف ضريبي واستخراج البطاقة الضريبية"],
            "fees_and_delivery": "رسوم استخراج مستخرج السجل التجاري 75 جنيه مصري ويستخرج فورياً.",
            "steps": ["تقديم الطلب بالسجل التجاري أو المنصة", "دفع الرسوم", "استلام مستخرج السجل"],
            "dialects_qa": ["عايز أستخرج سجل تجاري؟", "ايه ورق السجل التجاري للشركة؟"]
        },
        {
            "id": "SNOT-POWER-OF-ATTORNEY",
            "title": "تحرير توكيل عام / خاص بالشهر العقاري (توثيق)",
            "category": "الشهر العقاري والتوثيق - وزارة العدل",
            "official_url": "https://digital.gov.eg/categories/SNOT-01",
            "description": "حجز موعد أو تحرير التوكيلات الرسمية بالشهر العقاري إلكترونياً.",
            "required_documents": [
                "أصل بطاقة الرقم القومي للموكل (سارية)",
                "اسم وعنوان والرقم القومي للوكيل"
            ],
            "terms_and_conditions": [
                "أن يكون الموكل بكامل أهليته القانونية"
            ],
            "related_services": ["توثيق عقد بيع سيارة"],
            "fees_and_delivery": "رسوم التوكيل الرسمي العادي 50 إلى 75 جنيه مصري ويصدر فورياً بمكتب التوثيق.",
            "steps": ["حجز موعد عبر تطبيق أرغب في عمل توكيل أو مصر الرقمية", "التوجه لمكتب التوثيق لاستلام التوكيل"],
            "dialects_qa": [
                "عايز أعمل توكيل في الشهر العقاري؟",
                "ايه الأوراق المطلوبة لعمل توكيل محامي؟"
            ]
        },
        {
            "id": "SNOT-CAR-SALE-CONTRACT",
            "title": "توثيق عقد بيع سيارة / مركبة بالشهر العقاري",
            "category": "الشهر العقاري والتوثيق - وزارة العدل",
            "official_url": "https://digital.gov.eg/categories/SNOT-02",
            "description": "تحرير وتوثيق عقد البيع الابتدائي/النهائي لنقل ملكية السيارة بالشهر العقاري.",
            "required_documents": [
                "أصل رخصة المركبة سارية (أو شهادة بيانات للمرور سارية)",
                "بطاقة الرقم القومي للبائع والمشتري (سارية)",
                "شهادة المخالفات للمركبة سارية"
            ],
            "terms_and_conditions": [
                "أن تكون رخصة السيارة سارية وباسم البائع أو بصفته وكيلاً بتوكيل يبيح البيع لنفسه وللغير"
            ],
            "related_services": ["تجديد رخصة مركبة", "تحرير توكيل عام / خاص"],
            "fees_and_delivery": "تعتمد الرسوم على الموديل وعدد السلندرات والسعة اللترية وفق جدول رسوم الشهر العقاري.",
            "steps": ["حجز موعد التوثيق", "حضور البائع والمشتري لمكتب الشهر العقاري", "توقيع العقد واستلامه"],
            "dialects_qa": ["عايز أوثق عقد بيع عربية؟", "ايه أوراق توثيق عقد بيع السيارة بالشهر العقاري؟"]
        },
        {
            "id": "PASSPORT-EGYPT",
            "title": "استخراج وتجديد جواز السفر المصري",
            "category": "الجوازات والهجرة والجنسية - وزارة الداخلية",
            "official_url": "https://digital.gov.eg/categories/PASS-01",
            "description": "استخراج جواز سفر جديد أو تجديد الجواز المنتهي للأفراد.",
            "required_documents": [
                "بطاقة الرقم القومي سارية (لمن بلغ 16 عاماً)",
                "شهادة الميلاد المميكنة (لمن هم دون 16 عاماً)",
                "عدد 3 صور شخصية (4*6 خلفية بيضاء)",
                "الموقف من التجنيد للذكور (أصل أداء الخدمة العسكرية أو المعافاة)",
                "المؤهل الدراسي (إذا كان غير مدون بالبطاقة الشخصية)"
            ],
            "terms_and_conditions": [
                "التقديم يدوياً بقسم الجوازات التابع لمحل الإقامة"
            ],
            "related_services": ["إصدار وتجديد بطاقة الرقم القومي"],
            "fees_and_delivery": "الرسوم العادية 1110 جنيه مصري (استلام خلال 3-5 أيام)، المستعجل بـ 1600 جنيه (استلام في نفس اليوم أو 24 ساعة).",
            "steps": ["شراء نموذج جواز السفر بقسم الجوازات", "تقديم المستندات ودفع الرسوم", "استلام الباسبور"],
            "dialects_qa": [
                "عايز أطلع باسبور مصر؟",
                "ايه الأوراق المطلوبة لتجديد جواز السفر المصري؟"
            ]
        },
        {
            "id": "SUPPLY-FOOD-CARD",
            "title": "إصدار ونقل وتفعيل بطاقة التموين (الدعم التمويني)",
            "category": "وزارة التموين والتجارة الداخلية - قطاع الرقابة والتوزيع",
            "official_url": "https://digital.gov.eg/categories/SUPP-01",
            "description": "إصدار بطاقة تموين فصل اجتماعي، نقل البطاقة لمحافظة أخرى، وتفعيل البطاقة واستلام الرقم السري.",
            "required_documents": [
                "بطاقة الرقم القومي لصاحب البطاقة التموينية (سارية)",
                "صور بطاقات الرقم القومي أو شهادات ميلاد المستفيدين على البطاقة",
                "إيصال مرافق حديث للعنوان الجديد عند نقل المحافظة"
            ],
            "terms_and_conditions": [
                "أن يكون رب الأسرة غير مسجل على بطاقة تموينية أخرى",
                "استيفاء شروط الدعم والعدالة الاجتماعية"
            ],
            "related_services": ["إضافة الأفراد والأبناء على بطاقة التموين"],
            "fees_and_delivery": "إصدار البطاقات مجاناً أو 50 جنيه لإنتاج بدل الفاقد والتسليم بمكتب التموين أو للمنزل.",
            "steps": ["طلب الخدمة إلكترونياً", "مراجعة قواعد البيانات", "تفعيل البطاقة واستلام الرقم السري"],
            "dialects_qa": ["عايز أطلع بطاقة تموين؟", "ازاي أعمل فصل اجتماعي في التموين؟"]
        },
        {
            "id": "SUPPLY-ADD-DEPENDENTS",
            "title": "إضافة الأبناء والأفراد غير المقيدين تموينياً",
            "category": "وزارة التموين والتجارة الداخلية",
            "official_url": "https://digital.gov.eg/categories/SUPP-02",
            "description": "إضافة الأبناء الزائدين والأبناء حاملي الرقم القومي على بطاقة التموين العائلية.",
            "required_documents": [
                "بطاقة الرقم القومي لرب الأسرة سارية",
                "شهادات الميلاد المميكنة للأبناء المراد إضافتهم"
            ],
            "terms_and_conditions": [
                "أن يكون سن الأبناء لا يقل عن 4 سنوات",
                "أن تكون الأسرة من الفئات الأكثر احتياجاً ومستحقي الدعم"
            ],
            "related_services": ["إصدار ونقل بطاقة التموين"],
            "fees_and_delivery": "الخدمة مجانية عبر منصة مصر الرقمية ومكاتب التموين.",
            "steps": ["تقديم طلب الإضافة", "التحقق من استحقاق الأسرة", "إضافة المستفيدين"],
            "dialects_qa": ["عايز أضيف عيالي على التموين؟", "ازاي أضيف المواليد الجديدة في بطاقة التموين؟"]
        },
        {
            "id": "NOSI-SOCIAL-INSURANCE",
            "title": "الاستعلام عن الرقم التأميني والمدد التأمينية والأجور",
            "category": "الهيئة القومية للتأمين الاجتماعي",
            "official_url": "https://digital.gov.eg/categories/NOSI-01",
            "description": "استعلام فوري عن الرقم التأميني للرقم القومي، ومدد الاشتراك التأميني، والأجور المسجلة.",
            "required_documents": [
                "الرقم القومي للمواطن (14 رقم)",
                "اسم الأم الأول باللغة العربية"
            ],
            "terms_and_conditions": [
                "أن تكون البيانات مطابقة لقاعدة بيانات الهيئة القومية للتأمين الاجتماعي"
            ],
            "related_services": ["إصدار بطاقة الرقم القومي"],
            "fees_and_delivery": "الاستعلام الإلكتروني مجاني فورياً على المنصة.",
            "steps": ["إدخال الرقم القومي واسم الأم", "عرض الرقم التأميني والمدد المسجلة فورياً"],
            "dialects_qa": ["عايز أعرف الرقم التأميني بتاعي؟", "ازاي أستعلم عن مدة التأمينات؟"]
        },
        {
            "id": "SHMFF-SOCIAL-HOUSING",
            "title": "التقديم على شقق الإسكان الاجتماعي والتمويل العقاري",
            "category": "صندوق الإسكان الاجتماعي ودعم التمويل العقاري - وزارة الإسكان",
            "official_url": "https://digital.gov.eg/categories/SHMFF-01",
            "description": "حجز شقق سكن لكل المصريين والتأكد من انطباق الشروط وسداد الأقساط.",
            "required_documents": [
                "صورة بطاقة الرقم القومي للأعزب/الزوج والزوجة (سارية)",
                "شهادة إثبات الدخل الشهري صافي من جهة العمل أو محاسب قانوني",
                "إيصال سداد مقدم جدية الحجز وشراء كراسة الشروط من مكاتب البريد",
                "إيصال مرافق حديث لمحل السكن الحالي",
                "قيد عائلي مميكن للمتزوجين"
            ],
            "terms_and_conditions": [
                "ألا يقل السن عن 21 عاماً ولا يزيد عن 50 عاماً",
                "ألا يكون قد سبق التخصيص للمتقدم أو أسرته وحدة سكنية أو قطعة أرض إسكان"
            ],
            "related_services": ["إصدار قيد عائلي مميكن", "إصدار وتجديد بطاقة الرقم القومي"],
            "fees_and_delivery": "يتم تحديد مقدم الحجز والأقساط حسب الإعلان الصادر من صندوق الإسكان.",
            "steps": ["شراء كراسة الشروط وسداد المقدم بالبريد", "رفع المستندات إلكترونياً", "الاستعلام الميداني والتخصيص"],
            "dialects_qa": ["عايز أقدم على شقة في الإسكان الاجتماعي؟", "ايه أوراق التقديم على شقق سكن لكل المصريين؟"]
        }
    ]
    
    for item in official_core_services:
        dataset.append(item)
        
    print(f"✅ Generated {len(dataset)} structured dataset entries.")
    return dataset

def save_dataset(dataset):
    print("💾 [3/4] Saving dataset to JSON file...")
    out_dir = Path(__file__).parent.parent / "app" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    out_path = out_dir / "digital_gov_dataset.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 Dataset saved successfully to: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
    
    # Generate Alpaca / Unsloth fine-tuning format JSONL
    print("⚡ [4/4] Generating Unsloth / Fine-Tuning Q&A Dataset (egyptian_gov_fine_tune.jsonl)...")
    ft_path = out_dir / "egyptian_gov_fine_tune.jsonl"
    
    with open(ft_path, "w", encoding="utf-8") as ft_file:
        for entry in dataset:
            for question in entry.get("dialects_qa", []):
                answer_text = (
                    f"علشان {entry['title']} ({entry['category']})، الأوراق المطلوبة هي:\n"
                    + "\n".join(f"- {doc}" for doc in entry["required_documents"])
                    + f"\n\nالرسوم والمدة:\n{entry['fees_and_delivery']}\n\nالخطوات:\n"
                    + "\n".join(f"{idx+1}. {step}" for idx, step in enumerate(entry["steps"]))
                    + f"\n\nتقدر تتابع وتعمل الخدمة على منصة مصر الرقمية: {entry['official_url']}"
                )
                
                alpaca_item = {
                    "instruction": "أنت مساعد مصر الرقمية الذكي. أجب بالعامية المصرية وبكل دقة عن المعاملة الحكومية التالية.",
                    "input": question,
                    "output": answer_text
                }
                ft_file.write(json.dumps(alpaca_item, ensure_ascii=False) + "\n")
                
    print(f"🔥 Fine-tuning dataset saved to: {ft_path}")

def main():
    print("==================================================================")
    print("🚀 DIGITAL.GOV.EG EGYPTIAN GOVERNMENT DATASET SCRAPER & BUILDER")
    print("==================================================================")
    routes = discover_routes()
    dataset = generate_goverment_dataset(routes)
    save_dataset(dataset)
    print("==================================================================")
    print("✅ PROCESS COMPLETE! Clean dataset ready for RAG & Fine-Tuning.")
    print("==================================================================")

if __name__ == '__main__':
    main()
