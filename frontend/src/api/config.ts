import { apiClient as api } from "./client";

export interface ServiceAccounts {
  drive: string;
  firestore: string;
}

export async function getServiceAccounts(): Promise<ServiceAccounts> {
  return api.get<ServiceAccounts>("/api/config/service-accounts");
}
