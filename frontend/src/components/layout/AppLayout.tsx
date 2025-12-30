import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  LayoutDashboard,
  FolderKey,
  Shield,
  Users,
  Folders,
  FileText,
  FileClock,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  Tag,
  Folder,
  CreditCard,
  AlertCircle,
  Play,
  CheckSquare,
  Settings
} from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useTokenRefresh } from "../../hooks/useTokenRefresh";
import { useBillingStatus } from "../../hooks/useBillingStatus";

import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import logo from "../../assets/logo.png";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import { getAvatarUrl } from "../../utils/avatarUrl";


interface SidebarContentProps {
  user: any;

  onLogout: () => void;
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  collapsed: boolean;
  exact?: boolean;
  onClick?: () => void;
}

/**
 * Single sidebar navigation item with icon, label, active & hover states
 */
function SidebarNavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  exact,
  onClick,
}: SidebarNavItemProps) {
  return (
    <Tooltip delayDuration={collapsed ? 0 : 1000}>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          end={exact}
          onClick={onClick}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
              collapsed ? "justify-center px-0 mx-2" : "mx-2",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn(
                "h-5 w-5 shrink-0 transition-all duration-300",
                isActive ? "text-primary scale-110" : "text-muted-foreground/70 group-hover:text-foreground group-hover:scale-110"
              )} />
              {!collapsed && <span className="relative z-10">{label}</span>}
              
              {/* Active Indicator */}
              {isActive && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
              )}
            </>
          )}
        </NavLink>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

function SidebarContent({
  user,

  onLogout,
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: SidebarContentProps) {
  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    return email?.charAt(0).toUpperCase() || "U";
  };

  const avatarUrl = getAvatarUrl(user.picture);

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-xl border-r border-muted/20">
      {/* Sidebar header with logo */}
      <div className="h-20 flex items-center border-b border-muted/10 bg-background/20 px-3 relative">
        {/* Logo Icon - Absoluted to prevent jumping during w-16 -> w-64 transition */}
        <div className="h-10 w-10 shrink-0 flex items-center justify-center relative z-20">
          <img src={logo} alt="Vaultiqo" className="h-10 w-10" />
        </div>

        {/* Vaultiqo Text - Translating from left-13 (pl-3 offset) */}
        <div className={cn(
           "overflow-hidden transition-all duration-300 ease-in-out flex items-center",
           collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-3"
        )}>
          <span className="text-2xl font-bold tracking-tight whitespace-nowrap">
            <span key="branding" className="text-xl font-bold ml-2">
              Off<span className="text-[#0ECDBF]">days</span>
            </span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {/* Main Item (Dashboard/Items) - keeping logic but might rename later for Offdays context */}
        <SidebarNavItem
          to="/"
          label={t("sidebar.dashboard", "Dashboard")}
          icon={LayoutDashboard}
          collapsed={collapsed}
          exact
          onClick={handleNavClick}
        />
        <SidebarNavItem
          to="/approvals"
          label={t("sidebar.approvals", "Approvals")}
          icon={CheckSquare}
          collapsed={collapsed}
          onClick={handleNavClick}
        />


        {user.is_admin && (
          <div className="hidden md:block">
            {/* Admin section separator + label */}
            <div className="mt-6 mb-2">
              {!collapsed && (
                <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
                  {t("sidebar.administration_header")}
                </div>
              )}
              <div className="mx-4 border-t border-muted/30" />
            </div>

            <SidebarNavItem
              to="/admin/users"
              label={t("sidebar.users")}
              icon={Users}
              collapsed={collapsed}
              onClick={handleNavClick}
            />

            <SidebarNavItem
              to="/admin/subscription"
              label={t("billing.title")}
              icon={CreditCard}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            
            <SidebarNavItem
              to="/admin/settings"
              label={t("sidebar.settings", "Settings")}
              icon={Settings}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
          </div>
        )}
      </nav>

      {/* Footer with controls and user */}
      <div className="border-t">
        {/* Dark mode and collapse controls */}
        <div className={`p-2 space-y-1 border-b ${collapsed ? "flex flex-col items-center" : ""}`}>
          {/* Language Switcher */}
          <LanguageSwitcher collapsed={collapsed} />

          {/* Dark mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 ${collapsed ? "w-auto justify-center" : ""}`}
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" />
                    {!collapsed && <span className="ml-2">{t("sidebar.light_mode")}</span>}
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    {!collapsed && <span className="ml-2">{t("sidebar.dark_mode")}</span>}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {theme === "dark" ? t("sidebar.switch_light") : t("sidebar.switch_dark")}
            </TooltipContent>
          </Tooltip>
          {/* Collapse toggle */}
          {onToggleCollapse && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 ${collapsed ? "w-auto justify-center" : ""}`}
                  onClick={onToggleCollapse}
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      {t("sidebar.collapse")}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {/* User account */}
        <div className={`p-4 ${collapsed ? "p-2" : ""}`}>
          <div
            className={cn(
              "flex items-center gap-3 p-2 rounded-2xl bg-muted/20 border border-muted/10 transition-all hover:bg-muted/50",
              collapsed ? "flex-col gap-2" : ""
            )}
          >
            <Avatar className={collapsed ? "h-10 w-10" : "h-10 w-10 shrink-0 border-2 border-primary/10"}>
              <AvatarImage src={avatarUrl} alt={user.full_name || user.email} />
              <AvatarFallback className="bg-[#031c28] text-primary text-sm font-semibold">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">
                    {user.full_name || user.email}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 truncate font-medium">
                    {user.email}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={onLogout}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("sidebar.logout")}</TooltipContent>
                </Tooltip>
              </>
            )}
            {collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={onLogout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t("sidebar.logout")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { data: user, isLoading, refetch } = useCurrentUser();
  const { status: billingStatus } = useBillingStatus();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);



  // Automatically refresh token every 45 minutes
  useTokenRefresh();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner size="xl" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error(err);
    } finally {
      await refetch();
      navigate("/login");
    }
  };

  // Check for expired subscription
  const isExpired = billingStatus?.status === "expired";

  // If expired, show blocking overlay
  if (isExpired && !location.pathname.includes("/admin/subscription")) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
             <Card className="max-w-md w-full shadow-lg border-red-200 dark:border-red-900/50">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 bg-red-100 p-3 rounded-full w-fit dark:bg-red-900/30">
                        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                        {t("billing.trial_expired_title", "Trial Expired")}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                        {t("billing.trial_expired_desc", "Your trial period has ended. Please upgrade your subscription to continue using Offdays.")}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center pb-8">
                     <Button 
                        size="lg" 
                        onClick={() => navigate("/admin/subscription")}
                        className="w-full"
                    >
                        {t("billing.upgrade_now", "Upgrade Subscription")}
                     </Button>
                </CardFooter>
             </Card>
        </div>
      );
  }

  const isOverLimit = billingStatus && billingStatus.usage.limit > 0 && billingStatus.usage.users > billingStatus.usage.limit;
  const isNearLimit = billingStatus && billingStatus.usage.limit > 0 && (billingStatus.usage.users / billingStatus.usage.limit) >= 0.8;
  const showBillingWarning = user?.is_admin && (isOverLimit || isNearLimit);

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex bg-card border-r flex-col transition-[width] duration-300 ease-in-out ${
            sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          <SidebarContent
            user={user}

            onLogout={handleLogout}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() =>
              setSidebarCollapsed((prevCollapsed) => !prevCollapsed)
            }
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-64 p-0">
            <SidebarContent
              user={user}

              onLogout={handleLogout}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3 p-4 border-b border-border/40 bg-background/50">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="Vaultiqo" className="h-8 w-8" />
              <span className="text-lg font-bold">
                <span key="branding">Off<span className="text-[#0ECDBF]">days</span></span>
              </span>
            </div>
          </div>
          <main className="flex-1 overflow-auto">
             {showBillingWarning && !location.pathname.includes("/admin/subscription") && (
              <div className="mb-6">
                <Alert variant={isOverLimit ? "destructive" : "default"} className={`${isOverLimit ? "border-red-500" : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("billing.alerts.upgrade_needed")}</AlertTitle>
                  <AlertDescription>
                    {isOverLimit 
                      ? t("billing.alerts.upgrade_blocked") 
                      : t("billing.alerts.upgrade_suggestion")}
                    {" "}
                    <NavLink to="/admin/subscription" className="font-semibold underline">
                      {t("billing.manage_subscription")}
                    </NavLink>
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>


      <Toaster />
    </TooltipProvider>
  );
}