import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDateFormatter } from "@/hooks/useDateFormatter";
import { Check, X, Calendar as CalendarIcon, Loader2, CheckSquare, CheckCircle, Ban } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

    const { formatDateRange } = useDateFormatter();

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
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <CheckSquare className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("leaves.approvals_title", "Approvals")}</h1>
                    <p className="text-muted-foreground">{t("leaves.approvals_subtitle", "Manage leave requests and absence notifications from your team.")}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                     <CardTitle>{t("leaves.pending_requests", "Pending Requests / Notifications")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {requests?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="p-6 bg-muted/20 rounded-full">
                                <CheckCircle className="h-12 w-12 text-muted-foreground opacity-20" />
                            </div>
                            <div className="max-w-sm">
                                <h3 className="text-lg font-semibold">{t("leaves.no_pending", "No pending requests")}</h3>
                                <p className="text-muted-foreground">{t("leaves.no_pending_desc", "You're all caught up! There are no requests waiting for your approval.")}</p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("admin.users.name", "Name")}</TableHead>
                                    <TableHead>{t("admin.users.user_type", "Type")}</TableHead>
                                    <TableHead>{t("leaves.date", "Date")}</TableHead>
                                    <TableHead className="w-[100px]">{t("leaves.days", "Days")}</TableHead>
                                    <TableHead>{t("leaves.note", "Note")}</TableHead>
                                    <TableHead className="text-right"></TableHead>
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
                                            {req.user?.user_type === "contractor" ? (
                                                <Badge variant="outline" className="bg-orange-50/50 text-orange-700 border-orange-200">
                                                    {t("admin.users.type_contractor", "Contractor")}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200">
                                                    {t("admin.users.type_employee", "Employee")}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-foreground/80">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                {formatDateRange(req.start_date, req.end_date)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{req.days_count.toLocaleString(i18n.language)}</Badge>
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
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="h-8 w-8 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                                                                disabled={!!actionLoading}
                                                                onClick={() => handleAction(req.id, "reject")}
                                                            >
                                                                {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4"/>}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {t("leaves.reject", "Reject")}
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-500/10 transition-all"
                                                                disabled={!!actionLoading}
                                                                onClick={() => handleAction(req.id, "approve")}
                                                            >
                                                                {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {t("leaves.approve", "Approve")}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
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
