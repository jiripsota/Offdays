import { useEffect, useRef } from "react";
import { apiClient } from "../api/client";

const REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes in milliseconds

/**
 * Hook to automatically refresh the authentication token.
 * Calls /auth/refresh every 45 minutes to keep the user logged in.
 * If refresh fails (401), the API client will automatically redirect to login.
 */
export function useTokenRefresh() {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        await apiClient.post("/auth/refresh");
        console.log("Token refreshed successfully");
      } catch (error) {
        console.error("Token refresh failed:", error);
        // The API client will handle 401 by redirecting to login
      }
    };

    // Set up interval to refresh token every 45 minutes
    intervalRef.current = window.setInterval(refreshToken, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
