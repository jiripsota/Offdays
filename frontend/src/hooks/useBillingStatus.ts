import { useQuery } from "@tanstack/react-query";
import { getBillingStatus, BillingStatus } from "../api/billing";
import { useCurrentUser } from "./useCurrentUser";

export function useBillingStatus() {
  const { data: user } = useCurrentUser();

  const query = useQuery<BillingStatus, Error>({
    queryKey: ["billingStatus"],
    queryFn: () => getBillingStatus(),
    enabled: !!user?.is_admin,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { 
    status: query.data ?? null, 
    loading: query.isLoading, 
    error: query.error, 
    refetch: query.refetch 
  };
}
