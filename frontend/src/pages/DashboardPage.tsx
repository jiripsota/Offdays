import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { Plus, LayoutDashboard, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Loader2, Briefcase, CalendarDays, PieChart, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { RequestLeaveSheet } from "@/components/leaves/RequestLeaveSheet";

const fetchEntitlement = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/leaves/me/entitlement", {
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

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const dateLocale = i18n.language === 'cs' ? cs : enUS;

  const { data: entitlement, isLoading: loadingEntitlement, refetch: refetchEntitlement } = useQuery({
    queryKey: ["entitlement"],
    queryFn: fetchEntitlement
  });

  const { data: requests, isLoading: loadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchRequests
  });

  const handleSuccess = () => {
    refetchEntitlement();
    refetchRequests();
  };

  const handleAction = async (requestId: string, action: "delete" | "cancel-request") => {
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
      }
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
                <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title", "My Dashboard")}</h1>
                <p className="text-muted-foreground">{t("dashboard.subtitle", "Overview of your leave and requests.")}</p>
            </div>
        </div>
        <Button onClick={() => setShowRequestSheet(true)} size="lg" className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("leaves.new_request_btn", "Request Time Off")}
        </Button>
      </div>

      {/* Stats Cards - New Style */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.remaining", "Remaining")}</h3>
                    <div className="text-3xl font-bold text-primary">{entitlement?.remaining_days ?? 0}</div>
                 </div>
                 <div className="p-2 bg-primary/10 rounded-lg text-primary">
                     <CalendarDays className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.remaining_desc", "Days available this year")}</p>
             <div className="absolute -right-4 -bottom-4 bg-primary/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.accrued", "Accrued So Far")}</h3>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{entitlement?.accrued_days ?? 0}</div>
                 </div>
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                     <PieChart className="h-5 w-5" />
                 </div>
             </div>
             <p className="text-xs text-muted-foreground mt-4 z-10 relative">{t("leaves.accrued_desc", "Based on days worked")}</p>
             <div className="absolute -right-4 -bottom-4 bg-blue-50 dark:bg-blue-900/10 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="flex items-start justify-between z-10">
                 <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("leaves.used", "Used / Planned")}</h3>
                    <div className="text-3xl font-bold text-foreground">
                        {entitlement ? (entitlement.total_days - entitlement.remaining_days) : 0}
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
                    <div className="text-3xl font-bold text-foreground">{entitlement?.total_days ?? 0}</div>
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
        
        {requests?.length === 0 ? (
            <div className="text-center py-12 border rounded-xl border-dashed">
                <p className="text-muted-foreground">{t("leaves.no_requests", "No requests found.")}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {requests?.map((req: any) => (
                    <Card key={req.id} className="group hover:shadow-md transition-all duration-300">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                            <Badge variant="outline" className="w-fit">{req.days_count} {t("common.days", "days")}</Badge>
                            {statusBadge(req.status)}
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-muted/30 rounded-lg group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                                    <CalendarIcon className="h-5 w-5" />
                                </div>
                                <div className="text-sm font-medium">
                                    {format(new Date(req.start_date), "dd. MMM", { locale: dateLocale })} - {format(new Date(req.end_date), "dd. MMM yyyy", { locale: dateLocale })}
                                </div>
                             </div>
                             
                             {req.note && (
                                <p className="text-sm text-muted-foreground italic mb-4 line-clamp-2">
                                    "{req.note}"
                                </p>
                             )}

                             <div className="flex justify-end pt-2 border-t mt-auto">
                                {req.status === "pending" && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-center"
                                        disabled={!!isActionLoading}
                                        onClick={() => handleAction(req.id, "delete")}
                                    >
                                        {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.cancel", "Withdraw")}
                                    </Button>
                                )}
                                
                                {req.status === "approved" && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="w-full justify-center text-xs"
                                        disabled={!!isActionLoading}
                                        onClick={() => handleAction(req.id, "cancel-request")}
                                    >
                                        {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("leaves.request_cancel", "Request Cancellation")}
                                    </Button>
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
      />
    </div>
  );
}
