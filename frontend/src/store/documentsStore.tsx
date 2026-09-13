import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import type { Document } from "@/types/document";
import { apiClient } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/tokenStore";
import { ApiError, toApiError } from "@/lib/api/errors";

// Backed by the real, authenticated GET /api/documents/ (API_DOCUMENTATION.md
// §"GET /api/documents/") — most-recent-first, no pagination. Shared by
// Home/Archive/Document Detail/Chat/BottomTabBar so there's one fetch and one
// in-memory list, not one per screen.

type DocumentsState = {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getDocument: (id: number) => Document | undefined;
  deleteDocument: (id: number) => Promise<void>;
  addDocument: (doc: Document) => void;
};

const DocumentsContext = createContext<DocumentsState | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against overlapping fetches (e.g. tab focus firing while the
  // provider's own mount fetch is still in flight).
  const isFetchingRef = useRef(false);

  const refetch = useCallback(async () => {
    // No point calling an authenticated endpoint before the user is logged
    // in (landing/onboarding/login/register all mount this provider) — that
    // 401 would otherwise trip resilience.ts's refresh-then-bounce-to-/login
    // flow and yank a signed-out visitor off the landing page.
    const token = await getAccessToken();
    if (!token || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Document[]>("/api/documents/");
      setDocuments(data);
    } catch (err) {
      setError((err instanceof ApiError ? err : toApiError(err)).friendlyMessageAr);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const getDocument = useCallback((id: number) => documents.find((d) => d.id === id), [documents]);

  const deleteDocument = useCallback(async (id: number) => {
    await apiClient.delete(`/api/documents/${id}`);
    setDocuments((docs) => docs.filter((d) => d.id !== id));
  }, []);

  // Used by the scan flow to optimistically drop a newly-uploaded document
  // into the list without waiting on a full refetch.
  const addDocument = useCallback((doc: Document) => setDocuments((docs) => [doc, ...docs]), []);

  const value = useMemo(
    () => ({ documents, isLoading, error, refetch, getDocument, deleteDocument, addDocument }),
    [documents, isLoading, error, refetch, getDocument, deleteDocument, addDocument]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsState {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within a DocumentsProvider");
  return ctx;
}
