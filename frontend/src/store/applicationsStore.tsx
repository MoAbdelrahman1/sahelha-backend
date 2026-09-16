import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";

export type ServiceApplication = {
  id: number;
  service_id: string;
  service_title: string;
  reference_code: string;
  status: string;
  answers: Record<string, string>;
  created_at: string;
};

type ApplicationsState = {
  applications: ServiceApplication[];
  loading: boolean;
  refreshApplications: () => Promise<void>;
  submitApplication: (serviceId: string, answers: Record<string, string>) => Promise<ServiceApplication>;
};

const ApplicationsContext = createContext<ApplicationsState | null>(null);

const STORAGE_KEY = "sahelha_user_applications_v1";

function loadCachedApplications(): ServiceApplication[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

function saveCachedApplications(apps: ServiceApplication[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    }
  } catch {
    // Ignore write errors
  }
}

export function ApplicationsProvider({ children }: { children: React.ReactNode }) {
  const [applications, setApplications] = useState<ServiceApplication[]>(() => loadCachedApplications());
  const [loading, setLoading] = useState(false);

  const refreshApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<ServiceApplication[]>("/api/services/user/applications");
      if (Array.isArray(data)) {
        setApplications(data);
        saveCachedApplications(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshApplications();
  }, [refreshApplications]);

  const submitApplication = useCallback(
    async (serviceId: string, answers: Record<string, string>): Promise<ServiceApplication> => {
      const { data } = await apiClient.post<{
        reference_number: string;
        service_id: string;
        service_title: string;
        status: string;
        message: string;
      }>(`/api/services/${serviceId}/submit`, { answers });

      const newApp: ServiceApplication = {
        id: Date.now(),
        service_id: data.service_id,
        service_title: data.service_title,
        reference_code: data.reference_number,
        status: data.status,
        answers,
        created_at: new Date().toISOString(),
      };

      setApplications((prev) => {
        const updated = [newApp, ...prev];
        saveCachedApplications(updated);
        return updated;
      });

      return newApp;
    },
    []
  );

  const value = useMemo(
    () => ({
      applications,
      loading,
      refreshApplications,
      submitApplication,
    }),
    [applications, loading, refreshApplications, submitApplication]
  );

  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsState {
  const ctx = useContext(ApplicationsContext);
  if (!ctx) throw new Error("useApplications must be used within an ApplicationsProvider");
  return ctx;
}
