import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";

import { PremiumErrorBoundary } from "./components/ui/PremiumErrorBoundary";
import { AdminUsersPage } from "./components/admin/AdminUsersPage";
import { AdminSubscriptionPage } from "./components/admin/AdminSubscriptionPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <PremiumErrorBoundary />,
  },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <PremiumErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "admin/users", element: <AdminUsersPage /> },
      { path: "admin/subscription", element: <AdminSubscriptionPage /> },
      { path: "approvals", element: <ApprovalsPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  }
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}