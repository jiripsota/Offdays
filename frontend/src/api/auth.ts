import { apiClient } from "./client";

export interface CurrentUser {
  id: string;
  email: string;
  full_name?: string | null;
  picture?: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export const authApi = {
  me: () => apiClient.get<CurrentUser>("/auth/me"),
  getLoginUrl: () => apiClient.get<{ login_url: string }>("/auth/login"),
  logout: () => apiClient.post<{ detail: string }>("/auth/logout")
};