import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, User, UserUpdatePayload } from "../../api/users";
import { authApi, type CurrentUser } from "../../api/auth";
import { useBillingStatus } from "../../hooks/useBillingStatus";
import {
  Search,
  X,
  Shield,
  ShieldOff,
  CheckCircle,
  Ban,
  Users,
  UserPlus,
  Settings
} from "lucide-react";
import { GoogleUserSearchSheet } from "./GoogleUserSearchSheet";
import { UserEditSheet } from "./UserEditSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useDateFormatter } from "../../hooks/useDateFormatter";
import { getAvatarUrl } from "../../utils/avatarUrl";
import { GlassCard, PremiumBadge } from "../ui/premium";

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormatter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const { status: billingStatus } = useBillingStatus();
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Load current user so we can disable self-modification
  const { data: currentUser } = useQuery<CurrentUser, Error>({
    queryKey: ["currentUser"],
    queryFn: () => authApi.me(),
  });

  const {
    data: users,
    isLoading,
    error,
  } = useQuery<User[], Error>({
    queryKey: ["adminUsers"],
    queryFn: () => usersApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: UserUpdatePayload }) =>
      usersApi.update(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
    },
  });

  // Filter users by search query
  const filteredUsers = users?.filter((user) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.full_name && user.full_name.toLowerCase().includes(query))
    );
  });

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-8 bg-background/50">
      {/* Header / Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl shadow-inner border-primary/10 group/icon transition-all duration-300">
              <Users className="w-8 h-8 text-primary group-hover/icon:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {t("admin.users.title")}
                </h1>
                {users && (
                  <PremiumBadge variant="blue" className="px-2.5 rounded-full font-bold shadow-sm shadow-blue-500/10">
                    {users.length}
                  </PremiumBadge>
                )}
              </div>
              <p className="text-sm text-muted-foreground/80 font-medium">
                {t("admin.users.subtitle")}
              </p>
            </div>
          </div>
          <TooltipProvider>
            {(() => {
              const isLimitReached = !!billingStatus && billingStatus.usage.limit > 0 && 
                                    billingStatus.usage.users >= billingStatus.usage.hard_limit;
              
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={isLimitReached ? "cursor-not-allowed" : ""}>
                      <Button 
                        onClick={() => !isLimitReached && setShowGoogleSearch(true)} 
                        size="lg"
                        className="rounded-xl px-6 shadow-md shadow-primary/10 transition-all gap-2"
                        disabled={isLimitReached}
                      >
                        <UserPlus className="h-4 w-4" />
                        {t("admin.users.add_google")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isLimitReached 
                      ? t("admin.users.tooltips.limit_reached") 
                      : t("admin.users.tooltips.add_google")}
                  </TooltipContent>
                </Tooltip>
              );
            })()}
          </TooltipProvider>
      </div>

      {/* Search */}
      <GlassCard className="p-2 border-primary/5 items-center flex" hover={false}>
        <Search className="ml-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("admin.users.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-3 h-10 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="px-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </GlassCard>

      <Card className="relative overflow-hidden shadow-sm border-muted/20 bg-background/50 backdrop-blur-sm rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-muted/20">
              <TableHead className="px-4 py-3 h-11 font-medium text-muted-foreground">
                {t("admin.users.name")}
              </TableHead>
              <TableHead className="px-4 py-3 h-11 font-medium text-muted-foreground">
                {t("admin.users.role")}
              </TableHead>
              <TableHead className="px-4 py-3 h-11 font-medium text-muted-foreground">
                {t("admin.users.user_type")}
              </TableHead>
              <TableHead className="px-4 py-3 h-11 font-medium text-muted-foreground">
                {t("admin.users.status")}
              </TableHead>
              <TableHead className="px-4 py-3 h-11 font-medium text-muted-foreground">
                {t("admin.users.last_login")}
              </TableHead>
              <TableHead className="px-4 py-3 h-11 text-right font-medium text-muted-foreground">
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="px-4 py-3 text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}

            {error && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-4 py-8 text-center text-destructive"
                >
                  {t("admin.users.failed_load", { error: error.message })}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              filteredUsers &&
              filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t("admin.users.no_users_found")}
                  </TableCell>
                </TableRow>
              )}

            {!isLoading &&
              !error &&
              filteredUsers &&
              filteredUsers.map((user) => {
                const isSelf = currentUser?.id === user.id;

                return (
                  <TableRow 
                    key={user.id}
                    className="hover:bg-muted/40 active:bg-muted/60 transition-colors duration-75 border-muted/10"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={getAvatarUrl(user.picture)}
                            alt={user.full_name || user.email}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {user.full_name || user.email}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {user.is_admin ? (
                        <Badge variant="default">
                          {t("admin.users.admin")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t("admin.users.user")}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {user.user_type === "contractor" ? (
                        <Badge variant="outline" className="bg-orange-50/50 text-orange-700 border-orange-200">
                          {t("admin.users.type_contractor")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200">
                          {t("admin.users.type_employee")}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {user.is_active ? (
                        <Badge variant="outline">
                          {t("admin.users.active")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          {t("admin.users.inactive")}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {user.last_login
                        ? formatDateTime(user.last_login)
                        : t("admin.users.last_login_never")}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          {/* Role toggle button (admin <-> user) */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Wrapper span imitates disabled appearance but keeps tooltip working */}
                              <span
                                className={
                                  isSelf
                                    ? "inline-flex opacity-50 pointer-events-auto"
                                    : "inline-flex"
                                }
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={
                                    isSelf
                                      ? "h-8 w-8 text-muted-foreground/30 pointer-events-none"
                                      : "h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all"
                                  }
                                  // Prevent self-role modification in handler
                                  onClick={() => {
                                    if (isSelf) return;
                                    updateMutation.mutate({
                                      id: user.id,
                                      data: { is_admin: !user.is_admin },
                                    });
                                  }}
                                >
                                  {user.is_admin ? (
                                    <ShieldOff className="h-4 w-4 pointer-events-none" />
                                  ) : (
                                    <Shield className="h-4 w-4 pointer-events-none" />
                                  )}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf
                                ? t("admin.users.tooltips.cannot_change_self_role")
                                : user.is_admin
                                ? t("admin.users.tooltips.remove_admin_rights")
                                : t("admin.users.tooltips.make_admin")}
                            </TooltipContent>
                          </Tooltip>



                          {/* Edit User Button */}
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all"
                                onClick={() => setEditingUser(user)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("admin.users.tooltips.edit_settings", "Edit Settings")}
                            </TooltipContent>
                          </Tooltip>

                          {/* Active / disabled toggle button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {(() => {
                                const isLimitReached = !!billingStatus && billingStatus.usage.limit > 0 && 
                                                      billingStatus.usage.users >= billingStatus.usage.hard_limit;
                                const isDeactivating = user.is_active;
                                const isDisabled = isSelf || (!isDeactivating && isLimitReached);
                                
                                return (
                                  <span
                                    className={
                                      isDisabled
                                        ? "inline-flex opacity-50 cursor-not-allowed"
                                        : "inline-flex"
                                    }
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={
                                        isSelf
                                          ? "h-8 w-8 text-muted-foreground/30 pointer-events-none"
                                          : `h-8 w-8 transition-all ${
                                              user.is_active
                                                ? "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                                                : "text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-500/10"
                                            }`
                                      }
                                      onClick={() => {
                                        if (isDisabled) return;
                                        updateMutation.mutate({
                                          id: user.id,
                                          data: { is_active: !user.is_active },
                                        });
                                      }}
                                      disabled={isDisabled}
                                    >
                                      {user.is_active ? (
                                        <Ban className="h-4 w-4 pointer-events-none" />
                                      ) : (
                                        <CheckCircle className="h-4 w-4 pointer-events-none" />
                                      )}
                                    </Button>
                                  </span>
                                );
                              })()}
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf
                                ? t("admin.users.tooltips.cannot_deactivate_self")
                                : (() => {
                                    const isLimitReached = !!billingStatus && billingStatus.usage.limit > 0 && 
                                                          billingStatus.usage.users >= billingStatus.usage.hard_limit;
                                    
                                    if (!user.is_active && isLimitReached) {
                                      return t("admin.users.tooltips.limit_reached");
                                    }
                                    
                                    return user.is_active
                                      ? t("admin.users.tooltips.deactivate_user")
                                      : t("admin.users.tooltips.activate_user");
                                  })()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      <GoogleUserSearchSheet
        open={showGoogleSearch} 
        onOpenChange={setShowGoogleSearch} 
      />
      
      <UserEditSheet 
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
    </div>
  );
}