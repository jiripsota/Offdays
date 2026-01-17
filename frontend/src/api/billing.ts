import { apiClient as api } from "./client";

export interface BillingStatus {
  status: string;
  trial_ends_at: string | null;
  plan: {
    id: string;
    max_users: number;
    tier: string;
    cycle: string;
    storage_type: string;
  } | null;
  usage: {
    users: number;
    limit: number;
    hard_limit: number;
  };
}

export const getBillingStatus = async (): Promise<BillingStatus> => {
  const response = await api.get<BillingStatus>("/billing/current");
  return response;
};


