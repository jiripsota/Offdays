import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { RequestLeaveSheet } from "@/components/leaves/RequestLeaveSheet";

// Simple fetcher wrapper - this should ideally be in api/leaves.ts
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

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
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title", "My Dashboard")}</h1>
            <p className="text-muted-foreground">{t("dashboard.subtitle", "Overview of your leave and requests.")}</p>
        </div>
        <Button onClick={() => setShowRequestSheet(true)} size="lg" className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("leaves.new_request_btn", "Request Time Off")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("leaves.remaining", "Remaining")}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-primary">{entitlement?.remaining_days ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t("leaves.remaining_desc", "Days available this year")}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("leaves.accrued", "Accrued So Far")}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-blue-600">{entitlement?.accrued_days ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t("leaves.accrued_desc", "Based on days worked")}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("leaves.used", "Used / Planned")}</CardTitle>
            </CardHeader>
            <CardContent>
                  <div className="text-3xl font-bold">
                    {entitlement ? (entitlement.total_days - entitlement.remaining_days) : 0}
                  </div>
                <p className="text-xs text-muted-foreground">{t("leaves.used_desc", "Days requested or taken")}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("leaves.total", "Full Allowance")}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{entitlement?.total_days ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t("leaves.total_desc", "Contractual entitlement")}</p>
            </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
             <CardTitle>{t("leaves.recent_requests", "Recent Requests")}</CardTitle>
             <CardDescription>{t("leaves.recent_requests_desc", "History of your time off requests.")}</CardDescription>
        </CardHeader>
        <CardContent>
            {requests?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    {t("leaves.no_requests", "No requests found.")}
                </div>
            ) : (
                <div className="space-y-4">
                    {requests?.map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors">
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-2 bg-muted rounded-full">
                                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="font-semibold">
                                        {format(new Date(req.start_date), "MMM d")} - {format(new Date(req.end_date), "MMM d, yyyy")}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {req.days_count} {t("common.days", "days")} • {req.note || "No note"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {statusBadge(req.status)}
                                
                                {req.status === "pending" && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-destructive hover:bg-destructive/10"
                                        disabled={!!isActionLoading}
                                        onClick={() => handleAction(req.id, "delete")}
                                    >
                                        {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.cancel", "Withdraw")}
                                    </Button>
                                )}
                                
                                {req.status === "approved" && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-xs"
                                        disabled={!!isActionLoading}
                                        onClick={() => handleAction(req.id, "cancel-request")}
                                    >
                                        {isActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("leaves.request_cancel", "Request Cancellation")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>
        
      <RequestLeaveSheet 
        open={showRequestSheet} 
        onOpenChange={setShowRequestSheet} 
        onSuccess={handleSuccess}
        entitlement={entitlement}
      />
    </div>
  );
}
