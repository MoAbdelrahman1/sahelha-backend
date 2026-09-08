import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { Document } from "@/types/document";
import { DEMO_DOCUMENTS } from "@/features/documents/demoData";

// In-memory demo document list shared by Home/Archive/Document Detail/Chat, so
// "scan (demo) -> tap -> detail -> delete -> back to list" is a real,
// demonstrable loop without a backend. Used by 3+ features -> src/store/ per
// ARCHITECTURE.md's placement rule. Swap `DEMO_DOCUMENTS`/this provider for a
// real GET /api/documents/-backed store later; consumers only see `Document[]`.

type DocumentsState = {
  documents: Document[];
  getDocument: (id: number) => Document | undefined;
  deleteDocument: (id: number) => void;
  addDocument: (doc: Document) => void;
};

const DocumentsContext = createContext<DocumentsState | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>(DEMO_DOCUMENTS);

  const getDocument = useCallback((id: number) => documents.find((d) => d.id === id), [documents]);
  const deleteDocument = useCallback((id: number) => setDocuments((docs) => docs.filter((d) => d.id !== id)), []);
  const addDocument = useCallback((doc: Document) => setDocuments((docs) => [doc, ...docs]), []);

  const value = useMemo(
    () => ({ documents, getDocument, deleteDocument, addDocument }),
    [documents, getDocument, deleteDocument, addDocument]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsState {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within a DocumentsProvider");
  return ctx;
}
