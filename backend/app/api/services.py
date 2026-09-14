from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
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

    fields = SERVICE_FORM_SCHEMAS.get(service_id, DEFAULT_FORM_FIELDS)

    return ServiceFormSchemaResponse(
        service_id=matched["id"],
        service_title=matched["title"],
        category=matched.get("category", "خدمات حكومية"),
        description=matched.get("description", ""),
        fees_and_delivery=matched.get("fees_and_delivery", ""),
        required_documents=matched.get("required_documents", []),
        fields=fields,
    )


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
    ref_code = f"EGY-{uuid.uuid4().hex[:8].upper()}"

    print(f"[SERVICE FORM] User {current_user.get('id')} submitted form for {service_id} ({title}). Ref: {ref_code}.")

    return FormSubmissionResponse(
        reference_number=ref_code,
        service_id=service_id,
        service_title=title,
        status="مقبول وجارٍ المعالجة",
        message=f"تم استلام طلبك بنجاح برقم مرجعي {ref_code}. سيتم إشعارك فور إصدار المستند وموعد توصيله.",
    )
