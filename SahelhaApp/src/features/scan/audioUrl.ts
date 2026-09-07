import { API_BASE_URL } from "@/lib/config";

// POST /api/voice/tts's `audio_url` is not guaranteed to be one shape — this
// resolves all three cases the backend is known to return (see docs/API.md):
//  1. Absolute URL ("http..."): already playable as-is.
//  2. Root-relative path ("/uploads/1/tts_x.wav"): prefix with API_BASE_URL.
//  3. Bare cache key (neither of the above): resolve through the dedicated
//     GET /api/audio/{cache_key} endpoint.
export function resolveTtsAudioUrl(audioUrl: string): string {
  if (audioUrl.startsWith("http")) return audioUrl;
  if (audioUrl.startsWith("/")) return `${API_BASE_URL}${audioUrl}`;
  return `${API_BASE_URL}/api/audio/${audioUrl}`;
}
