import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Document } from "@/types/document";
import { DEMO_DOCUMENTS } from "@/features/documents/demoData";
import { apiClient } from "@/lib/api/client";

// Persistent real document list shared by Home/Archive/Document Detail/Chat, backed
// by both the server SQLite database (/api/documents/) and local cache.
// Scanned documents are stored for the registered user in the database.

type DocumentsState = {
  documents: Document[];
  getDocument: (id: number) => Document | undefined;
  deleteDocument: (id: number) => void;
  addDocument: (doc: Document) => void;
  refreshDocuments: () => Promise<void>;
};

const DocumentsContext = createContext<DocumentsState | null>(null);

const STORAGE_KEY = "sahelha_documents_v1";

function loadSavedDocuments(): Document[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEMO_DOCUMENTS;
}

function saveDocuments(docs: Document[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }
  } catch {
    // Ignore storage write errors
  }
}

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>(() => loadSavedDocuments());

  const refreshDocuments = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Document[]>("/api/documents");
      if (Array.isArray(data)) {
        setDocuments(data);
        saveDocuments(data);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  const getDocument = useCallback((id: number) => documents.find((d) => d.id === id), [documents]);

  const deleteDocument = useCallback(async (id: number) => {
    setDocuments((docs) => {
      const updated = docs.filter((d) => d.id !== id);
      saveDocuments(updated);
      return updated;
    });
    try {
      await apiClient.delete(`/api/documents/${id}`);
    } catch {
      // Ignore delete failure
    }
  }, []);

  const addDocument = useCallback((doc: Document) => {
    setDocuments((docs) => {
      const withoutDuplicate = docs.filter((d) => d.id !== doc.id);
      const updated = [doc, ...withoutDuplicate];
      saveDocuments(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ documents, getDocument, deleteDocument, addDocument, refreshDocuments }),
    [documents, getDocument, deleteDocument, addDocument, refreshDocuments]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsState {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within a DocumentsProvider");
  return ctx;
}
