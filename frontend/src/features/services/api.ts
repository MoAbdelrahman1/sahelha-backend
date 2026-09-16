import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { FALLBACK_SERVICES } from "./fallbackData";

export type GovernmentService = {
  id: string;
  title: string;
  category: string;
  official_url?: string;
  description: string;
  required_documents: string[];
  terms_and_conditions?: string[];
  related_services?: string[];
  fees_and_delivery: string;
  steps?: string[];
  dialects_qa?: string[];
};

export type FormField = {
  id: string;
  label: string;
  prompt: string;
  field_type: "name" | "national_id" | "phone" | "text" | "confirmation";
  required: boolean;
  placeholder?: string;
};

export type ServiceFormSchema = {
  service_id: string;
  service_title: string;
  category: string;
  description: string;
  fees_and_delivery: string;
  required_documents: string[];
  fields: FormField[];
};

export type FormSubmissionResponse = {
  reference_number: string;
  service_id: string;
  service_title: string;
  status: string;
  message: string;
};

export async function fetchServices(): Promise<GovernmentService[]> {
  try {
    const { data } = await apiClient.get<GovernmentService[]>("/api/services");
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
    return FALLBACK_SERVICES;
  } catch (error) {
    console.warn("[API] fetchServices failed, using fallback scraped dataset", error);
    return FALLBACK_SERVICES;
  }
}

export async function fetchServiceDetail(serviceId: string): Promise<GovernmentService> {
  try {
    const { data } = await apiClient.get<GovernmentService>(`/api/services/${serviceId}`);
    return data;
  } catch (error) {
    const found = FALLBACK_SERVICES.find((s) => s.id === serviceId);
    if (found) return found;
    throw toApiError(error);
  }
}

export function buildFallbackFormSchema(service: GovernmentService): ServiceFormSchema {
  const fields: FormField[] = [
    {
      id: "full_name",
      label: "الاسم الرباعي لمقدم الطلب",
      prompt: `أهلاً بك في التقديم الصوتي لخدمة ${service.title}. من فضلك، قول اسمك الرباعي بالكامل زي ما هو مكتوب في بطاقة الرقم القومي`,
      field_type: "name",
      required: true,
      placeholder: "مثال: محمد أحمد محمود علي",
    },
    {
      id: "national_id",
      label: "الرقم القومي (14 رقم)",
      prompt: "من فضلك، قول رقمك القومي المكون من 14 رقم",
      field_type: "national_id",
      required: true,
      placeholder: "مثال: 29801011234567",
    },
    {
      id: "phone",
      label: "رقم الموبايل للتواصل",
      prompt: "ايه هو رقم الموبايل للتواصل ومتابعة طلب التقديم؟",
      field_type: "phone",
      required: true,
      placeholder: "مثال: 01012345678",
    },
  ];

  if (service.required_documents && service.required_documents.length > 0) {
    service.required_documents.forEach((docName, idx) => {
      fields.push({
        id: `doc_confirm_${idx + 1}`,
        label: `تأكيد جاهزية: ${docName}`,
        prompt: `تطلب هذه الخدمة توفر (${docName}). هل المستند جاهز معاك وموجود؟ قول نعم أو لا`,
        field_type: "confirmation",
        required: true,
        placeholder: "نعم / لا",
      });
    });
  }

  fields.push({
    id: "delivery_address",
    label: "عنوان التوصيل أو الاستلام بالمنزل",
    prompt: "من فضلك، قول عنوان التوصيل بالتفصيل: المحافظة والمنطقة واسم الشارع ورقم العقار",
    field_type: "text",
    required: true,
    placeholder: "المحافظة، المدينة، الشارع، ورقم العقار",
  });

  return {
    service_id: service.id,
    service_title: service.title,
    category: service.category,
    description: service.description,
    fees_and_delivery: service.fees_and_delivery,
    required_documents: service.required_documents || [],
    fields,
  };
}

export async function fetchServiceForm(serviceId: string): Promise<ServiceFormSchema> {
  try {
    const { data } = await apiClient.get<ServiceFormSchema>(`/api/services/${serviceId}/form`);
    return data;
  } catch (error) {
    const service = FALLBACK_SERVICES.find((s) => s.id === serviceId);
    if (service) {
      return buildFallbackFormSchema(service);
    }
    throw toApiError(error);
  }
}

export async function submitServiceForm(
  serviceId: string,
  answers: Record<string, string>
): Promise<FormSubmissionResponse> {
  try {
    const { data } = await apiClient.post<FormSubmissionResponse>(`/api/services/${serviceId}/submit`, {
      answers,
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
