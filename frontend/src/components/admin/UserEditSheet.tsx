import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserCog } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { User, usersApi } from "../../api/users";
import { leavesApi } from "../../api/leaves";

interface UserEditSheetProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditSheet({ user, open, onOpenChange }: UserEditSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [supervisorId, setSupervisorId] = useState<string>("none");
  const [userType, setUserType] = useState<"employee" | "contractor">("employee");
  const [totalDays, setTotalDays] = useState<string>("20");
  const [remainingDays, setRemainingDays] = useState<string>("20");

  // Fetch all users for supervisor select
  const { data: users } = useQuery({
    queryKey: ["adminUsersForSelect"],
    queryFn: () => usersApi.list(),
    enabled: open
  });

  // Fetch entitlement
  const { data: entitlement, isLoading: loadingEntitlement } = useQuery({
    queryKey: ["adminUserEntitlement", user?.id],
    queryFn: () => user ? leavesApi.getAdminEntitlement(user.id) : Promise.resolve(null),
    enabled: !!user && open
  });

  useEffect(() => {
    if (user) {
        setSupervisorId(user.supervisor_id || "none");
        setUserType(user.user_type);
    }
  }, [user]);

  useEffect(() => {
    if (entitlement) {
        setTotalDays(entitlement.total_days.toString());
        setRemainingDays(entitlement.remaining_days.toString());
    }
  }, [entitlement]);

  const updateMutation = useMutation({
    mutationFn: async () => {
        if (!user) return;
        
        // Update Supervisor & User Type
        const supId = supervisorId === "none" ? null : supervisorId;
        const needsUserUpdate = supId !== user.supervisor_id || userType !== user.user_type;
        
        if (needsUserUpdate) {
            await usersApi.update(user.id, { 
                supervisor_id: supId,
                user_type: userType
            });
        }
        
        // Update Entitlement (only for employees)
        if (userType === "employee") {
            await leavesApi.updateAdminEntitlement(user.id, {
                total_days: parseFloat(totalDays),
                remaining_days: parseFloat(remainingDays)
            });
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
        queryClient.invalidateQueries({ queryKey: ["adminUserEntitlement"] });
        toast({
            title: t("common.success"),
            description: t("admin.users.update_success", "User updated successfully"),
        });
        onOpenChange(false);
    },
    onError: (err) => {
        console.error(err);
        toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("admin.users.update_failed", "Failed to update user"),
        });
    }
  });

  const isLoading = loadingEntitlement || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-6 py-6 border-b border-border/40 flex-row items-center gap-4 space-y-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg font-bold truncate leading-tight">
              {t("admin.users.edit_user", "Edit User")}: {user?.full_name || user?.email}
            </SheetTitle>
            <p className="text-xs text-muted-foreground truncate opacity-70">
              {t("admin.users.edit_user_desc", "Manage supervisor and leave entitlement.")}
            </p>
          </div>
        </SheetHeader>
        
        <div className="space-y-6 px-6 py-6 flex-1 overflow-y-auto min-h-0">
            
            <div className="space-y-2">
                <Label>{t("admin.users.user_type", "Type")}</Label>
                <Select value={userType} onValueChange={(val: "employee" | "contractor") => setUserType(val)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="employee">{t("admin.users.type_employee")}</SelectItem>
                        <SelectItem value="contractor">{t("admin.users.type_contractor")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>{t("admin.users.supervisor", "Supervisor")}</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                    <SelectTrigger>
                        <SelectValue placeholder={t("admin.users.select_supervisor")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">{t("common.none", "None")}</SelectItem>
                        {users?.filter(u => u.id !== user?.id).map(u => (
                            <SelectItem key={u.id} value={u.id}>
                                {u.full_name || u.email}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {userType === "employee" && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>{t("leaves.total_days", "Total Days (Year)")}</Label>
                        <Input 
                            type="number" 
                            value={totalDays}
                            onChange={(e) => setTotalDays(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t("leaves.remaining_days", "Remaining Days")}</Label>
                        <Input 
                            type="number" 
                            value={remainingDays}
                            onChange={(e) => setRemainingDays(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </div>
        
        {/* Sticky Footer with Shadow */}
        <div className="p-6 bg-background mt-auto z-20 relative flex justify-end">
            <div className="absolute left-0 right-0 bottom-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <Button onClick={() => updateMutation.mutate()} disabled={isLoading} className="w-full sm:w-auto min-w-[150px] rounded-2xl font-bold h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.save", "Save Changes")}
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
