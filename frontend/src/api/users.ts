import { apiClient } from "./client";

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  is_active: boolean;
  user_type: "employee" | "contractor";
  created_at: string;
  picture?: string | null;
  last_login?: string | null;
  supervisor_id?: string | null;
}

export interface UserUpdatePayload {
  full_name?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  user_type?: "employee" | "contractor";
  supervisor_id?: string | null;
}

export interface UserCreatePayload {
  email: string;
  full_name?: string | null;
  is_admin?: boolean;
  user_type?: "employee" | "contractor";
}

export const usersApi = {
  list: () => apiClient.get<User[]>("/users"),
  get: (id: string) => apiClient.get<User>(`/users/${id}`),
  create: (payload: UserCreatePayload) => apiClient.post<User>("/users", payload),
  update: (id: string, payload: UserUpdatePayload) =>
    apiClient.patch<User>(`/users/${id}`, payload),
  listAllForSharing: () => apiClient.get<User[]>("/users/all"),
  searchGoogleWorkspace: (query: string) =>
    apiClient.get<User[]>(`/integrations/google/search-users?query=${encodeURIComponent(query)}`),
};