import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDateFormatter } from "@/hooks/useDateFormatter";
import { Plus, LayoutDashboard, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Loader2, Briefcase, CalendarDays, PieChart, CheckSquare, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { RequestLeaveSheet } from "@/components/leaves/RequestLeaveSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fetchEntitlement = async (year: number) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/leaves/me/entitlement?year=${year}`, {
     headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const fetchRequests = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/leaves/me/requests", {
     headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const getCzechDaysLabel = (count: number) => {
    if (count === 1) return "den";
    if (count === 0.5) return "dne";
    if (count >= 2 && count <= 4) return "dny";
    return "dní";
};

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{id: string, action: "delete" | "cancel-request"} | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { formatDateRange } = useDateFormatter();

  const queryClient = useQueryClient();

  // Load ALL requests to determine if we have future ones
  const { data: allRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchRequests
  });

  const { data: entitlement, isLoading: loadingEntitlement } = useQuery({
    queryKey: ["entitlement", selectedYear],
    queryFn: () => fetchEntitlement(selectedYear)
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["entitlement"] });
    queryClient.invalidateQueries({ queryKey: ["my-requests"] });
  };

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const isFutureYear = selectedYear > currentYear;

  // Filter requests for display
  const displayedRequests = allRequests?.filter((req: any) => new Date(req.start_date).getFullYear() === selectedYear);
  
  // Check if we have requests for next year
  const hasNextYearRequests = allRequests?.some((req: any) => new Date(req.start_date).getFullYear() === nextYear);

  // Calculate statistics from displayed requests
  const usedOrPlannedDays = displayedRequests?.reduce((sum: number, req: any) => {
      // Count Approved, Pending, Cancel Pending
      if (['approved', 'pending', 'cancel_pending'].includes(req.status)) {
          return sum + req.days_count;
      }
      return sum;
  }, 0) || 0;

  const totalDays = entitlement?.total_days || 20; // Fallback or use entitlement total
  const remainingDaysCalc = totalDays - usedOrPlannedDays;

  const executeAction = async (requestId: string, action: "delete" | "cancel-request") => {
      setIsActionLoading(requestId);
      try {
          const method = action === "delete" ? "DELETE" : "POST";
          const endpoint = action === "delete" ? `/api/leaves/${requestId}` : `/api/leaves/${requestId}/request-cancel`;
          
          const res = await fetch(endpoint, {
              method,
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          
          if (!res.ok) throw new Error("Action failed");
          
          toast({
              title: t("common.success"),
              description: t(`leaves.${action}_success`, "Request updated successfully"),
          });
          handleSuccess();
      } catch (err) {
          toast({
              variant: "destructive",
              title: t("common.error"),
              description: t("common.error_desc", "Operation failed"),
          });
      } finally {
          setIsActionLoading(null);
          setConfirmDialog(null);
      }
  };

  const handleActionClick = (requestId: string, action: "delete" | "cancel-request") => {
      setConfirmDialog({ id: requestId, action });
  };

  const statusBadge = (status: string) => {
    switch (status) {
        case "approved": return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1"/> {t("status.approved", "Approved")}</Badge>;
        case "rejected": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> {t("status.rejected", "Rejected")}</Badge>;
        case "pending": return <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/25 border-yellow-500/20"><Clock className="w-3 h-3 mr-1"/> {t("status.pending", "Pending")}</Badge>;
        case "cancel_pending": return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50"><Clock className="w-3 h-3 mr-1"/> {t("status.cancel_pending", "Cancel Pending")}</Badge>;
        case "cancelled": return <Badge variant="outline" className="opacity-60">{t("status.cancelled", "Cancelled")}</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loadingEntitlement || loadingRequests) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="flex-1 w-full p-6 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <LayoutDashboard className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title", "My Dashboard")} <span className="text-muted-foreground ml-2 font-light">{selectedYear}</span></h1>
                <p className="text-muted-foreground">{t("dashboard.subtitle", "Overview of your leave and requests.")}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {hasNextYearRequests && (
                <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-muted/30">
                     <Button 
                        variant={selectedYear === currentYear ? "default" : "ghost"} 
                        size="sm"
                        onClick={() => setSelectedYear(currentYear)}
                        className="text-xs h-7"
                     >
                        {currentYear}
                     </Button>
                     <Button 
                        variant={selectedYear === nextYear ? "default" : "ghost"} 
                        size="sm" 
                        onClick={() => setSelectedYear(nextYear)}
                        className="text-xs h-7"
                     >
                        {nextYear}
                     </Button>
                </div>
            )}
            
            <Button onClick={() => setShowRequestSheet(true)} size="lg" className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("leaves.new_request_btn", "Request Time Off")}
            </Button>
        </div>
      </div>

      {/* Stats Cards - New Style */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.remaining", "Remaining")}</h3>
                    <div className="text-3xl font-bold text-primary">{remainingDaysCalc.toLocaleString(i18n.language)}</div>
                 </div>
                 <div className="p-2 bg-primary/10 rounded-lg text-primary">
                     <CalendarDays className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.remaining_desc", "Days available this year")}</p>
             <div className="absolute -right-4 -bottom-4 bg-primary/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>

        {isFutureYear ? (
           <div className="bg-card/50 rounded-xl border border-dashed shadow-sm p-4 flex flex-col items-center justify-center text-center text-muted-foreground opacity-60">
                <span className="text-xs font-medium">{t("leaves.accrued_not_started", "Accrual starts Jan 1")}</span>
           </div>
        ) : (
        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.accrued", "Accrued So Far")}</h3>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{entitlement?.accrued_days?.toLocaleString(i18n.language) ?? 0}</div>
                 </div>
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                     <PieChart className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.accrued_desc", "Based on days worked")}</p>
             <div className="absolute -right-4 -bottom-4 bg-blue-50 dark:bg-blue-900/10 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>
        )}

        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.used", "Used / Planned")}</h3>
                    <div className="text-3xl font-bold text-foreground">
                        {usedOrPlannedDays.toLocaleString(i18n.language)}
                    </div>
                 </div>
                 <div className="p-2 bg-muted rounded-lg text-foreground">
                     <CheckSquare className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.used_desc", "Days requested or taken")}</p>
             <div className="absolute -right-4 -bottom-4 bg-muted/50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.total", "Full Allowance")}</h3>
                    <div className="text-3xl font-bold text-foreground">{entitlement?.total_days?.toLocaleString(i18n.language) ?? 0}</div>
                 </div>
                 <div className="p-2 bg-muted rounded-lg text-foreground">
                     <Briefcase className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.total_desc", "Contractual entitlement")}</p>
             <div className="absolute -right-4 -bottom-4 bg-muted/50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>
      </div>

      {/* Recent Requests - Grid Layout */}
      <div>
        <div className="mb-4">
             <h2 className="text-xl font-bold tracking-tight">{t("leaves.recent_requests", "Recent Requests")}</h2>
             <p className="text-muted-foreground font-medium text-sm">{t("leaves.recent_requests_desc", "History of your time off requests.")}</p>
        </div>
        
        {displayedRequests?.length === 0 ? (
            <div className="text-center py-12 border rounded-xl border-dashed">
                <p className="text-muted-foreground">{t("leaves.no_requests", "No requests found.")}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedRequests?.map((req: any) => (
                    <Card key={req.id} className="group relative hover:shadow-md transition-all duration-300 overflow-hidden">
                        {/* Action Buttons - Top Right (Float) */}
                         <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            {req.status === "pending" && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    disabled={!!isActionLoading}
                                    onClick={() => handleActionClick(req.id, "delete")}
                                    title={t("common.cancel", "Withdraw")}
                                >
                                    {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                </Button>
                            )}
                            
                            {req.status === "approved" && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    disabled={!!isActionLoading}
                                    onClick={() => handleActionClick(req.id, "cancel-request")}
                                    title={t("leaves.request_cancel", "Request Cancellation")}
                                >
                                    {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                </Button>
                            )}
                         </div>

                        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                            {statusBadge(req.status)}
                        </CardHeader>

                        <CardContent className="px-4 pb-4">
                             <div className="mb-2">
                                <div className="text-lg font-bold text-foreground">
                                    {formatDateRange(req.start_date, req.end_date)}
                                </div>
                             </div>

                             <div className="flex items-center justify-between mt-4">
                                <Badge variant="secondary" className="font-normal text-xs">
                                    {req.days_count.toLocaleString(i18n.language)} {i18n.language === 'cs' ? getCzechDaysLabel(req.days_count) : t("common.days", "days")}
                                </Badge>
                                
                                {req.note && (
                                    <span className="text-xs text-muted-foreground italic truncate max-w-[100px]" title={req.note}>
                                        {req.note}
                                    </span>
                                )}
                             </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
        
      <RequestLeaveSheet 
        open={showRequestSheet} 
        onOpenChange={setShowRequestSheet} 
        onSuccess={handleSuccess}
        entitlement={entitlement}
        remainingDays={remainingDaysCalc}
      />

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t("common.confirm_title", "Are you sure?")}</AlertDialogTitle>
                <AlertDialogDescription>
                    {t("common.confirm_desc", "This action cannot be undone.")}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => confirmDialog && executeAction(confirmDialog.id, confirmDialog.action)}>
                    {t("common.confirm", "Confirm")}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
