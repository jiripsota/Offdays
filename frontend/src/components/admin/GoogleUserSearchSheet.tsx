import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Search, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "../../utils/avatarUrl";
import { usersApi, User } from "../../api/users";
import { useBillingStatus } from "../../hooks/useBillingStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

interface GoogleUser {
  name: string;
  email: string;
  avatar?: string;
}

interface GoogleUserSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleUserSearchSheet({ open, onOpenChange }: GoogleUserSearchSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { status: billingStatus } = useBillingStatus();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Reset search when sheet closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: results, isLoading, isFetching, error } = useQuery<GoogleUser[]>({
    queryKey: ["googleUserSearch", debouncedQuery],
    queryFn: () => usersApi.searchGoogleWorkspace(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });
  
  // Fetch existing users to check for duplicates
  const { data: existingUsers } = useQuery<User[]>({
    queryKey: ["adminUsers"],
    queryFn: () => usersApi.list(),
  });

  const importMutation = useMutation({
    mutationFn: (user: GoogleUser) => 
      usersApi.create({ 
        email: user.email, 
        full_name: user.name,
        is_admin: false
      }),
    onSuccess: (_, user) => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
      toast({
        title: t("admin.users.import_success"),
        description: t("admin.users.import_success_desc", { name: user.name }),
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: t("admin.users.import_failed"),
        description: err.response?.data?.detail || "Could not import user.",
      });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[540px] p-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-6 py-6 border-b border-border/40 flex-row items-center gap-4 space-y-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner group-hover/header:scale-110 transition-transform duration-300">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg font-bold truncate leading-tight">
              {t("admin.users.workspace_users_title")}
            </SheetTitle>
            <p className="text-xs text-muted-foreground truncate opacity-70">
              {t("admin.users.workspace_users_description")}
            </p>
          </div>
        </SheetHeader>

        <div className="px-6 py-6 flex-1 flex flex-col min-h-0 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin.users.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isFetching && results && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 relative mt-8">
            <div className="absolute inset-0 overflow-y-auto pr-2">
              <div className="space-y-4">
            {(isLoading || (isFetching && !results)) && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground animate-pulse">{t("admin.users.loading")}</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12 text-destructive text-sm bg-destructive/5 rounded-lg border border-destructive/10">
                {t("common.error")}: Failed to fetch Workspace users.
              </div>
            )}

            {!isLoading && results && results.length === 0 && debouncedQuery.length >= 2 && (
              <div className="text-center py-12 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                {t("admin.users.no_users_found")}
              </div>
            )}

            {!isLoading && !results && debouncedQuery.length < 2 && (
                <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center gap-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                    <Search className="h-10 w-10 opacity-20" />
                    <p className="max-w-[200px] leading-relaxed">{t("admin.users.search_prompt")}</p>
                </div>
            )}

            {results?.map((user) => (
              <div key={user.email} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-[#031c28] text-primary font-medium">
                        {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                </div>
                <TooltipProvider>
                  {(() => {
                    const alreadyExists = existingUsers?.some(eu => eu.email.toLowerCase() === user.email.toLowerCase());
                    const isLimitReached = !!(billingStatus && billingStatus.usage.limit > 0 && 
                                          billingStatus.usage.users >= billingStatus.usage.hard_limit);
                    const isImporting = !!(importMutation.isPending && importMutation.variables?.email === user.email);
                    
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={(alreadyExists || isLimitReached) ? "cursor-not-allowed" : ""}>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className={cn(
                                "rounded-full h-9 w-9 p-0 transform active:scale-90 transition-all group-hover:opacity-100",
                                !alreadyExists && !isLimitReached && !isImporting && "hover:bg-primary hover:text-primary-foreground",
                                (alreadyExists || isLimitReached || isImporting) ? "opacity-40" : "opacity-0"
                              )}
                              onClick={() => !alreadyExists && !isLimitReached && importMutation.mutate(user)}
                              disabled={isImporting || alreadyExists || isLimitReached}
                            >
                              {isImporting ? (
                                <Spinner size="sm" />
                              ) : alreadyExists ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {alreadyExists 
                            ? t("admin.users.tooltips.user_already_imported") 
                            : isLimitReached
                            ? t("admin.users.tooltips.limit_reached")
                            : t("admin.users.tooltips.import_user")}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </TooltipProvider>
              </div>
            ))}
              </div>
            </div>
            {/* Bottom Scroll Shadow */}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
