import { apiClient } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";

// GET /api/archive/share/{doc_id} — auth required, 404s if the document
// doesn't exist or isn't owned by the current user. Returns a base64 PNG QR
// encoding `share_url` plus the plain url itself.
export type ShareInfo = {
  qr_image_base64: string;
  share_url: string;
};

export async function fetchShareInfo(docId: number): Promise<ShareInfo> {
  try {
    const { data } = await apiClient.get<ShareInfo>(`/api/archive/share/${docId}`);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
