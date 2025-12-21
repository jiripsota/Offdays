import { useQuery } from "@tanstack/react-query";
import { authApi, CurrentUser } from "../api/auth";

export function useCurrentUser() {
  return useQuery<CurrentUser | null, Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        const user = await authApi.me();
        return user;
      } catch {
        return null;
      }
    },
    staleTime: 60_000
  });
}