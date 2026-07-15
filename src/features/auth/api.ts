import { apiClient } from "@/lib/api/client";
import { saveTokens } from "@/lib/api/tokenStore";
import { toApiError } from "@/lib/api/errors";

// Mirrors the confirmed Swagger contract for /api/auth/register,
// /api/auth/login, and /api/auth/me — see docs/API.md. This is the one place
// to update when the contract changes.
export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
};

export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
  phone: string;
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
      email: email.trim().toLowerCase(),
      password,
    });
    await saveTokens(data.access_token, data.refresh_token);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/register", {
      ...input,
      email: input.email.trim().toLowerCase(),
    });
    await saveTokens(data.access_token, data.refresh_token);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

// Returns the bare user object directly — /api/auth/me is NOT wrapped in a
// `{ user: ... }` envelope like login/register are.
export async function getMe(): Promise<AuthUser> {
  try {
    const { data } = await apiClient.get<AuthUser>("/api/auth/me");
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
