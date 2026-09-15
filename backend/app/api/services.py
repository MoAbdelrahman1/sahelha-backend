import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user, now_iso
from app.db import db_connection
from app.services.rag_service import load_dataset

router = APIRouter()


class FormFieldSchema(BaseModel):
    id: str
    label: str
    prompt: str
    field_type: str  # "name", "national_id", "phone", "text", "confirmation"
    required: bool = True
    placeholder: Optional[str] = None


class ServiceFormSchemaResponse(BaseModel):
    service_id: str
    service_title: str
    category: str
    description: str
    fees_and_delivery: str
    required_documents: List[str]
    fields: List[FormFieldSchema]


class FormSubmissionRequest(BaseModel):
    answers: Dict[str, str]


class FormSubmissionResponse(BaseModel):
    reference_number: str
    service_id: str
    service_title: str
    status: str
    message: str


SERVICE_FORM_SCHEMAS: Dict[str, List[FormFieldSchema]] = {
    "CSOFA-MARRIAGE-CERTIFICATE": [
        FormFieldSchema(
            id="full_name",
            label="الاسم الرباعي لمقدم الطلب",
            prompt="من فضلك، قول اسمك الرباعي بالكامل زي ما هو مكتوب في بطاقة الرقم القومي",
            field_type="name",
            placeholder="مثال: محمد أحمد محمود علي",
        ),
        FormFieldSchema(
            id="national_id",
            label="الرقم القومي (14 رقم)",
            prompt="من فضلك، قول رقمك القومي المكون من 14 رقم",
            field_type="national_id",
            placeholder="مثال: 29801011234567",
        ),
        FormFieldSchema(
            id="spouse_name",
            label="اسم الطرف الثاني (الزوج / الزوجة)",
            prompt="ايه هو اسم الزوج أو الزوجة بالكامل؟",
            field_type="name",
            placeholder="اسم الزوج / الزوجة",
        ),
        FormFieldSchema(
            id="phone",
            label="رقم الموبايل للتواصل",
            prompt="ايه هو رقم الموبايل للتواصل ومتابعة موعد الاستلام؟",
            field_type="phone",
            placeholder="مثال: 01012345678",
        ),
        FormFieldSchema(
            id="delivery_address",
            label="عنوان استلام المستند بالمنزل",
            prompt="قول عنوان التوصيل بالتفصيل، المحافظة والمنطقة واسم الشارع",
            field_type="text",
            placeholder="المحافظة، المدينة، الشارع، ورقم العقار",
        ),
    ],
    "CSOFA-BIRTH-CERTIFICATE": [
        FormFieldSchema(
            id="full_name",
            label="اسم مقدم الطلب (الأب أو الأم)",
            prompt="من فضلك، قول اسمك الرباعي بالكامل",
            field_type="name",
            placeholder="اسم مقدم الطلب",
        ),
        FormFieldSchema(
            id="national_id",
            label="الرقم القومي لمقدم الطلب",
            prompt="قول رقمك القومي المكون من 14 رقم",
            field_type="national_id",
            placeholder="14 رقم",
        ),
        FormFieldSchema(
            id="child_name",
            label="اسم المولود بالكامل",
            prompt="ايه هو اسم المولود المطلوب استخراج الشهادة ليه؟",
            field_type="name",
            placeholder="اسم المولود",
        ),
        FormFieldSchema(
            id="mother_name",
            label="اسم والدة المولود",
            prompt="ايه هو اسم والدة المولود ثلاثياً؟",
            field_type="name",
            placeholder="اسم الأم",
        ),
        FormFieldSchema(
            id="phone",
            label="رقم الموبايل للتواصل",
            prompt="ايه هو رقم الموبايل للتواصل؟",
            field_type="phone",
            placeholder="01xxxxxxxxx",
        ),
        FormFieldSchema(
            id="delivery_address",
            label="عنوان الاستلام والتوصيل",
            prompt="قول عنوان التوصيل بالتفصيل",
            field_type="text",
            placeholder="عنوان التوصيل",
        ),
    ],
    "CSOFA-ID-CARD": [
        FormFieldSchema(
            id="full_name",
            label="الاسم الرباعي بالكامل",
            prompt="من فضلك، قول اسمك الرباعي بالكامل زي ما في بطاقتك السابقة",
            field_type="name",
            placeholder="الاسم الرباعي",
        ),
        FormFieldSchema(
            id="national_id",
            label="الرقم القومي الحالي (14 رقم)",
            prompt="قول رقمك القومي المكون من 14 رقم",
            field_type="national_id",
            placeholder="14 رقم",
        ),
        FormFieldSchema(
            id="profession",
            label="المهنة أو جهة العمل",
            prompt="ايه هي المهنة أو المؤهل المطلوب إثباته بالبطاقة؟",
            field_type="text",
            placeholder="المهنة",
        ),
        FormFieldSchema(
            id="phone",
            label="رقم الموبايل",
            prompt="ايه هو رقم الموبايل للتواصل؟",
            field_type="phone",
            placeholder="01xxxxxxxxx",
        ),
        FormFieldSchema(
            id="delivery_address",
            label="عنوان الاستلام بالمنزل",
            prompt="قول عنوان محل الإقامة الحالي لتسليم البطاقة",
            field_type="text",
            placeholder="العنوان بالتفصيل",
        ),
    ],
    "STRF-VEHICLE-LICENSE-RENEWAL": [
        FormFieldSchema(
            id="full_name",
            label="اسم مالك العربية بالكامل",
            prompt="من فضلك، قول اسم مالك العربية بالكامل",
            field_type="name",
            placeholder="اسم المالك",
        ),
        FormFieldSchema(
            id="national_id",
            label="الرقم القومي للمالك",
            prompt="قول الرقم القومي لمالك العربية المكون من 14 رقم",
            field_type="national_id",
            placeholder="14 رقم",
        ),
        FormFieldSchema(
            id="plate_number",
            label="رقم لوحة العربية",
            prompt="ايه هو رقم لوحة العربية الحروف والأرقام؟",
            field_type="text",
            placeholder="مثال: س ص ع 123",
        ),
        FormFieldSchema(
            id="phone",
            label="رقم الموبايل",
            prompt="ايه هو رقم الموبايل المسجل للمرور؟",
            field_type="phone",
            placeholder="01xxxxxxxxx",
        ),
        FormFieldSchema(
            id="delivery_address",
            label="عنوان توصيل رخصة العربية",
            prompt="قول عنوان توصيل الرخصة الجديدة بالتفصيل",
            field_type="text",
            placeholder="عنوان التوصيل",
        ),
    ],
}

DEFAULT_FORM_FIELDS: List[FormFieldSchema] = [
    FormFieldSchema(
        id="full_name",
        label="الاسم الرباعي لمقدم الطلب",
        prompt="من فضلك، قول اسمك الرباعي بالكامل",
        field_type="name",
        placeholder="الاسم الرباعي",
    ),
    FormFieldSchema(
        id="national_id",
        label="الرقم القومي (14 رقم)",
        prompt="قول رقمك القومي المكون من 14 رقم",
        field_type="national_id",
        placeholder="14 رقم",
    ),
    FormFieldSchema(
        id="phone",
        label="رقم الموبايل للتواصل",
        prompt="ايه هو رقم الموبايل للتواصل ومتابعة الطلب؟",
        field_type="phone",
        placeholder="01xxxxxxxxx",
    ),
    FormFieldSchema(
        id="delivery_address",
        label="عنوان الاستلام والتوصيل",
        prompt="قول عنوان التوصيل بالتفصيل",
        field_type="text",
        placeholder="عنوان الاستلام",
    ),
]


@router.get("", response_model=List[Dict[str, Any]])
def list_services() -> List[Dict[str, Any]]:
    dataset = load_dataset()
    return dataset


@router.get("/{service_id}", response_model=Dict[str, Any])
def get_service_detail(service_id: str) -> Dict[str, Any]:
    dataset = load_dataset()
    for item in dataset:
        if item.get("id") == service_id:
            return item
    raise HTTPException(status_code=404, detail="Service not found")


@router.get("/{service_id}/form", response_model=ServiceFormSchemaResponse)
def get_service_form_schema(service_id: str) -> ServiceFormSchemaResponse:
    dataset = load_dataset()
    matched = None
    for item in dataset:
        if item.get("id") == service_id:
            matched = item
            break

    if not matched:
        raise HTTPException(status_code=404, detail="Service not found")

    if service_id in SERVICE_FORM_SCHEMAS:
        fields = SERVICE_FORM_SCHEMAS[service_id]
    else:
        req_docs = matched.get("required_documents", [])
        title = matched.get("title", "الخدمة")
        fields = [
            FormFieldSchema(
                id="full_name",
                label="الاسم الرباعي لمقدم الطلب",
                prompt=f"أهلاً بك في التقديم الصوتي لخدمة {title}. من فضلك، قول اسمك الرباعي بالكامل زي ما هو مكتوب في بطاقة الرقم القومي",
                field_type="name",
                placeholder="مثال: محمد أحمد محمود علي",
            ),
            FormFieldSchema(
                id="national_id",
                label="الرقم القومي (14 رقم)",
                prompt="من فضلك، قول رقمك القومي المكون من 14 رقم",
                field_type="national_id",
                placeholder="مثال: 29801011234567",
            ),
            FormFieldSchema(
                id="phone",
                label="رقم الموبايل للتواصل",
                prompt="ايه هو رقم الموبايل للتواصل ومتابعة طلب التقديم؟",
                field_type="phone",
                placeholder="مثال: 01012345678",
            ),
        ]
        for idx, doc_name in enumerate(req_docs, 1):
            fields.append(
                FormFieldSchema(
                    id=f"doc_confirm_{idx}",
                    label=f"تأكيد جاهزية: {doc_name}",
                    prompt=f"تطلب هذه الخدمة توفر ({doc_name}). هل المستند جاهز معاك وموجود؟ قول نعم أو لا",
                    field_type="confirmation",
                    placeholder="نعم / لا",
                )
            )
        fields.append(
            FormFieldSchema(
                id="delivery_address",
                label="عنوان التوصيل أو الاستلام بالمنزل",
                prompt="من فضلك، قول عنوان التوصيل بالتفصيل: المحافظة والمنطقة واسم الشارع ورقم العقار",
                field_type="text",
                placeholder="المحافظة، المدينة، الشارع، ورقم العقار",
            )
        )

    return ServiceFormSchemaResponse(
        service_id=matched["id"],
        service_title=matched["title"],
        category=matched.get("category", "خدمات حكومية"),
        description=matched.get("description", ""),
        fees_and_delivery=matched.get("fees_and_delivery", ""),
        required_documents=matched.get("required_documents", []),
        fields=fields,
    )


@router.get("/user/applications", response_model=List[Dict[str, Any]])
def list_user_applications(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    user_id = current_user.get("id", 1)
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM service_applications
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()

    results = []
    for r in rows:
        answers = {}
        if r["answers_json"]:
            try:
                answers = json.loads(r["answers_json"])
            except Exception:
                pass
        results.append(
            {
                "id": r["id"],
                "service_id": r["service_id"],
                "service_title": r["service_title"],
                "reference_code": r["reference_code"],
                "status": r["status"],
                "answers": answers,
                "created_at": r["created_at"],
            }
        )
    return results


@router.post("/{service_id}/submit", response_model=FormSubmissionResponse)
def submit_service_form(
    service_id: str,
    body: FormSubmissionRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> FormSubmissionResponse:
    dataset = load_dataset()
    matched = None
    for item in dataset:
        if item.get("id") == service_id:
            matched = item
            break

    title = matched["title"] if matched else service_id
    ref_code = f"REQ-2026-{uuid.uuid4().hex[:6].upper()}"
    user_id = current_user.get("id", 1)
    created_at = now_iso()

    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO service_applications (user_id, service_id, service_title, reference_code, status, answers_json, created_at)
            VALUES (?, ?, ?, ?, 'قيد المعالجة', ?, ?)
            """,
            (user_id, service_id, title, ref_code, json.dumps(body.answers), created_at),
        )
        connection.commit()

    print(f"[SERVICE FORM] User {user_id} submitted form for {service_id} ({title}). Ref: {ref_code}.")

    return FormSubmissionResponse(
        reference_number=ref_code,
        service_id=service_id,
        service_title=title,
        status="قيد المعالجة",
        message=f"تم استلام طلبك بنجاح برقم مرجعي {ref_code}. سيتم إشعارك فور إصدار المستند وموعد توصيله.",
    )
