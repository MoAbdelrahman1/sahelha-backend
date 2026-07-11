import { apiClient } from "@/lib/api/client";
import { saveTokens } from "@/lib/api/tokenStore";
import { toApiError } from "@/lib/api/errors";

// Mirrors the FastAPI backend's response shape for /auth/register and
// /auth/login. The contract isn't final — this is the one place to update
// when it changes.
export type AuthUser = {
  id?: string;
  email: string;
  full_name?: string;
  phone?: string;
  [key: string]: unknown;
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
  full_name?: string;
  phone?: string;
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

export async function getMe(): Promise<AuthUser> {
  try {
    const { data } = await apiClient.get<AuthUser>("/api/auth/me");
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
