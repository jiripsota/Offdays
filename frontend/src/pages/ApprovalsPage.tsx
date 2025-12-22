import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { Check, X, Calendar as CalendarIcon, Loader2, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fetchApprovals = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/leaves/approvals", {
       headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

export function ApprovalsPage() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const dateLocale = i18n.language === 'cs' ? cs : enUS;

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
        <div className="flex-1 w-full p-6 space-y-8">
            <div className="flex items-center gap-4 border-b pb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <CheckSquare className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("leaves.approvals", "Approvals")}</h1>
                    <p className="text-muted-foreground">{t("leaves.approvals_desc", "Manage leave requests from your team.")}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                     <CardTitle>{t("leaves.pending_requests", "Pending Requests")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {requests?.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {t("leaves.no_pending", "No pending requests.")}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("admin.users.name", "Name")}</TableHead>
                                    <TableHead>{t("admin.users.role", "Dates")}</TableHead>
                                    <TableHead className="w-[100px]">{t("leaves.days", "Days")}</TableHead>
                                    <TableHead>{t("leaves.note", "Note")}</TableHead>
                                    <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests?.map((req: any) => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={req.user?.picture} />
                                                    <AvatarFallback>{req.user?.full_name?.charAt(0) || "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">
                                                        {req.user?.full_name || req.user?.email || "Unknown User"}
                                                    </span>
                                                    {req.status === "cancel_pending" && (
                                                        <span className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">
                                                            {t("status.cancel_pending", "Cancel Requested")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-foreground/80">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                {format(new Date(req.start_date), "d. MMM", { locale: dateLocale })} - {format(new Date(req.end_date), "d. MMM yyyy", { locale: dateLocale })}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{req.days_count} {t("common.days_short", "d")}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            {req.note ? (
                                                <span className="text-sm text-muted-foreground italic truncate block" title={req.note}>
                                                    {req.note}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/30 text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    disabled={!!actionLoading}
                                                    onClick={() => handleAction(req.id, "reject")}
                                                    title={req.status === "cancel_pending" ? t("leaves.deny_cancel", "Deny") : t("common.reject", "Reject")}
                                                >
                                                    {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4"/>}
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    disabled={!!actionLoading}
                                                    onClick={() => handleAction(req.id, "approve")}
                                                    title={req.status === "cancel_pending" ? t("leaves.approve_cancel", "Confirm Cancellation") : t("common.approve", "Approve")}
                                                >
                                                    {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
