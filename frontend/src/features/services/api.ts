import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

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
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchServiceDetail(serviceId: string): Promise<GovernmentService> {
  try {
    const { data } = await apiClient.get<GovernmentService>(`/api/services/${serviceId}`);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchServiceForm(serviceId: string): Promise<ServiceFormSchema> {
  try {
    const { data } = await apiClient.get<ServiceFormSchema>(`/api/services/${serviceId}/form`);
    return data;
  } catch (error) {
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
