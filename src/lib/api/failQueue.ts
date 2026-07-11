import type { AxiosInstance, AxiosRequestConfig } from "axios";
import NetInfo from "@react-native-community/netinfo";

// In-memory only — cleared on app restart. Persisting this queue across
// restarts (e.g. to SecureStore) is a future upgrade, out of scope here.
const MAX_QUEUE_SIZE = 20;
let queue: AxiosRequestConfig[] = [];
let draining = false;

export function enqueueFailedRequest(config: AxiosRequestConfig): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // drop the oldest to stay bounded
  }
  queue.push(config);
}

export function getQueuedRequestCount(): number {
  return queue.length;
}

// Manual redrive hook — call this from a "retry" affordance in the UI, or let
// startFailQueueAutoDrain below call it automatically when connectivity
// returns. Requests that fail again are re-enqueued by the resilience
// interceptor itself (same retryable-error path as any other request).
export async function drainFailedRequestQueue(client: AxiosInstance): Promise<void> {
  if (draining || queue.length === 0) return;
  draining = true;
  const pending = queue;
  queue = [];
  for (const config of pending) {
    try {
      await client(config);
    } catch {
      // Still failing — the response interceptor already classified and
      // (if transient) re-queued it, so there's nothing further to do here.
    }
  }
  draining = false;
}

let unsubscribeNetInfo: (() => void) | null = null;

export function startFailQueueAutoDrain(client: AxiosInstance): void {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drainFailedRequestQueue(client);
    }
  });
}

export function stopFailQueueAutoDrain(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}
