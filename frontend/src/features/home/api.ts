import { apiClient } from "@/lib/api/client";

// GET /api/ready has no documented response keys (Swagger just shows an
// arbitrary untyped object) — the entire contract is the HTTP status: 200
// means the backend is reachable, anything else (4xx/5xx/network/timeout)
// means it isn't. Never parse the body.
export async function checkBackendReady(): Promise<boolean> {
  try {
    const response = await apiClient.get("/api/ready");
    return response.status === 200;
  } catch {
    return false;
  }
}
