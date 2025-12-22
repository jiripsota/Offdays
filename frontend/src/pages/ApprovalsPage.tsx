import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Check, X, Calendar as CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const fetchApprovals = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/leaves/approvals", {
       headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

export function ApprovalsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const { data: requests, isLoading, refetch } = useQuery({
        queryKey: ["approvals"],
        queryFn: fetchApprovals
    });

    const handleAction = async (id: string, action: "approve" | "reject") => {
        setActionLoading(id);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/leaves/${id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Failed");
            
            toast({
                title: t(`leaves.${action}d`, `${action === "approve" ? "Approved" : "Rejected"}`),
                description: t(`leaves.request_${action}d_desc`, `The request has been ${action}d.`),
            });
            refetch();
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t("common.error"),
                description: t("leaves.action_failed", "Action failed"),
            });
        } finally {
            setActionLoading(null);
        }
    }

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Spinner /></div>;
    }

    return (
        <div className="flex-1 w-full max-w-5xl mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{t("leaves.approvals", "Approvals")}</h1>
                <p className="text-muted-foreground">{t("leaves.approvals_desc", "Manage leave requests from your team.")}</p>
            </div>

            <Card>
                <CardHeader>
                     <CardTitle>{t("leaves.pending_requests", "Pending Requests")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {requests?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t("leaves.no_pending", "No pending requests.")}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests?.map((req: any) => (
                                <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="hidden md:block">
                                            {/* Assuming user info is enriched or we fetch it? 
                                                Schema has `user: Optional[UserRead]`. 
                                                We need to update backend to return user info!
                                                Wait, my router impl didn't explicitly join User or use `response_model` that includes it properly? 
                                                The response model `LeaveRequestRead` has `user: Optional[UserRead]`.
                                                But in `leaves.py` I just did `db.scalars(select(LeaveRequest)...)`. 
                                                SQLAlchemy lazy loading might handle it IF the relationship is set up?
                                                Yes, `user` relationship exists in model. Pydantic `orm_mode` will trigger lazy load.
                                                However, `async` loading might be an issue if session is closed? 
                                                FastAPI dependency session is open during request. 
                                                So it should work.
                                            */}
                                            <Avatar>
                                                <AvatarImage src={req.user?.picture} />
                                                <AvatarFallback>{req.user?.full_name?.charAt(0) || "? स्वातंत्र"}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div>
                                            <div className="font-semibold flex items-center gap-2">
                                                {req.user?.full_name || req.user?.email || "Unknown User"}
                                                {req.status === "cancel_pending" && (
                                                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px] uppercase font-bold px-1.5 py-0">
                                                        {t("status.cancel_pending", "Cancellation Request")}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                <CalendarIcon className="h-3 w-3" />
                                                {format(new Date(req.start_date), "MMM d")} - {format(new Date(req.end_date), "MMM d, yyyy")}
                                                <span className="mx-1">•</span>
                                                {req.days_count} {t("common.days", "days")}
                                            </div>
                                            {req.note && (
                                                <p className="text-sm mt-1 italic text-muted-foreground">"{req.note}"</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end md:self-auto">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            disabled={!!actionLoading}
                                            onClick={() => handleAction(req.id, "reject")}
                                        >
                                            {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 mr-1"/>}
                                            {req.status === "cancel_pending" ? t("leaves.deny_cancel", "Deny") : t("common.reject", "Reject")}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                            disabled={!!actionLoading}
                                            onClick={() => handleAction(req.id, "approve")}
                                        >
                                            {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 mr-1"/>}
                                            {req.status === "cancel_pending" ? t("leaves.approve_cancel", "Confirm Cancellation") : t("common.approve", "Approve")}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
