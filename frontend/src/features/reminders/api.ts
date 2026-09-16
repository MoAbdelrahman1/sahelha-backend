import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

// Mirrors GET/POST/DELETE /api/reminders/ (backend/app/api/reminders.py).
// The backend has no explicit "auto vs manual" flag — reminders created by
// app/services/reminder_service.create_reminder_from_expiry() always carry
// this exact message prefix, so that's how the UI tells them apart from
// reminders the user typed in themselves.
export type Reminder = {
  id: number;
  document_id: number | null;
  remind_at: string;
  message: string | null;
  sent: boolean;
  created_at: string;
};

export const AUTO_REMINDER_MESSAGE_PREFIX = "مستندك ينتهي في";

export function isAutoReminder(reminder: Reminder): boolean {
  return Boolean(reminder.message?.startsWith(AUTO_REMINDER_MESSAGE_PREFIX));
}

export async function fetchReminders(): Promise<Reminder[]> {
  try {
    const { data } = await apiClient.get<Reminder[]>("/api/reminders/");
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function createReminder(body: {
  document_id?: number | null;
  remind_at: string;
  message?: string | null;
}): Promise<Reminder> {
  try {
    const { data } = await apiClient.post<Reminder>("/api/reminders/", body);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function deleteReminder(id: number): Promise<void> {
  try {
    await apiClient.delete(`/api/reminders/${id}`);
  } catch (error) {
    throw toApiError(error);
  }
}
