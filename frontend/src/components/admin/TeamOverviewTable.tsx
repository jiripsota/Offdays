import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { User } from "@/api/users";
import { leavesApi } from "@/api/leaves";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getInitials } from "@/utils/avatarUrl";
import { useMemo } from "react";
import { parseISO } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { useDateFormatter } from "@/hooks/useDateFormatter";
import { Clock } from "lucide-react";

interface TeamOverviewTableProps {
    users: User[];
    year: number;
    onUserSelect: (userId: string) => void;
}

export function TeamOverviewTable({ users, year, onUserSelect }: TeamOverviewTableProps) {
    const { t } = useTranslation();

    const employees = users.filter(u => u.user_type === "employee");
    const contractors = users.filter(u => u.user_type === "contractor");

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {employees.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold px-1">{t("admin.users.employees", "Employees")}</h3>
                    <div className="rounded-xl border border-muted/20 overflow-hidden bg-card/50 backdrop-blur-sm">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-muted/20">
                                    <TableHead className="w-[300px]">{t("admin.users.name", "Name")}</TableHead>
                                    <TableHead className="text-right">{t("leaves.used", "Used / Planned")}</TableHead>
                                    <TableHead className="text-center">{t("leaves.next_leave", "Next Vacation")}</TableHead>
                                    <TableHead className="text-center">{t("leaves.pending_requests", "Pending Requests")}</TableHead>
                                    <TableHead className="text-right">{t("leaves.accrued_total", "Accrued / Contractual")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map(user => (
                                    <EmployeeRow 
                                        key={user.id} 
                                        user={user} 
                                        year={year} 
                                        onClick={() => onUserSelect(user.id)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {contractors.length > 0 && (
                <div className="space-y-4">
                     <h3 className="text-lg font-semibold px-1">{t("admin.users.contractors", "Contractors")}</h3>
                     <div className="rounded-xl border border-muted/20 overflow-hidden bg-card/50 backdrop-blur-sm">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-muted/20">
                                    <TableHead className="w-[300px]">{t("admin.users.name", "Name")}</TableHead>
                                    <TableHead className="text-right">{t("leaves.used_contractor", "Absence / Planned")}</TableHead>
                                    <TableHead className="text-center">{t("leaves.next_absence", "Next Absence")}</TableHead>
                                    <TableHead className="text-center">{t("leaves.pending_notifications", "Pending Notifications")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contractors.map(user => (
                                    <ContractorRow 
                                        key={user.id} 
                                        user={user} 
                                        year={year}
                                        onClick={() => onUserSelect(user.id)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}

function EmployeeRow({ user, year, onClick }: { user: User, year: number, onClick: () => void }) {
    const { formatDateRange } = useDateFormatter();
    const { t, i18n } = useTranslation();

    const { data: leaves, isLoading: loadingLeaves } = useQuery({
        queryKey: ["userLeaves", user.id],
        queryFn: () => leavesApi.getUserLeaves(user.id)
    });

    const { data: entitlement, isLoading: loadingEntitlement } = useQuery({
        queryKey: ["userEntitlement", user.id, year],
        queryFn: () => leavesApi.getUserEntitlement(user.id, year)
    });

    const usedOrPlanned = useMemo(() => {
        return leaves?.filter(req => new Date(req.start_date).getFullYear() === year)
            .reduce((sum, req) => {
                if (['approved', 'pending', 'cancel_pending'].includes(req.status)) {
                    return sum + req.days_count;
                }
                return sum;
            }, 0) || 0;
    }, [leaves, year]);

    const nextAbsence = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return leaves
            ?.filter(r => ["approved", "pending"].includes(r.status))
            .filter(r => parseISO(r.start_date) >= today)
            .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())[0];
    }, [leaves]);

    const pendingCount = useMemo(() => {
        return leaves?.filter(r => r.status === "pending").length || 0;
    }, [leaves]);

    const isLoading = loadingLeaves || loadingEntitlement;

    return (
        <TableRow onClick={onClick} className="cursor-pointer hover:bg-muted/5 transition-colors border-muted/10">
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(user.picture)} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.full_name || user.email}</span>
                        {user.full_name && <span className="text-[10px] text-muted-foreground">{user.email}</span>}
                    </div>
                </div>
            </TableCell>
            <TableCell className="text-right font-medium">
                {isLoading ? <Spinner size="sm" className="ml-auto" /> : (
                    <span>{usedOrPlanned.toLocaleString(i18n.language)}</span>
                )}
            </TableCell>
            <TableCell className="text-center text-sm">
                {isLoading ? <Spinner size="sm" className="mx-auto" /> : (
                     nextAbsence ? (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateRange(nextAbsence.start_date, nextAbsence.end_date)}
                        </div>
                    ) : (
                        <span className="text-muted-foreground/40 text-xs">-</span>
                    )
                )}
            </TableCell>
             <TableCell className="text-center font-medium">
                {isLoading ? <Spinner size="sm" className="mx-auto" /> : (
                    pendingCount > 0 ? (
                         <div className="inline-flex items-center justify-center bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full px-2 py-0.5 text-xs font-bold border border-orange-500/20">
                            {pendingCount}
                         </div>
                    ) : (
                        <span className="text-muted-foreground/40 text-xs">-</span>
                    )
                )}
            </TableCell>
            <TableCell className="text-right">
                {isLoading ? <Spinner size="sm" className="ml-auto" /> : (
                    <div className="font-medium">
                         <span className="text-blue-600 dark:text-blue-400">{entitlement?.accrued_days?.toLocaleString(i18n.language) ?? "-"}</span>
                         <span className="text-muted-foreground/40 font-light mx-2">/</span>
                         <span className="text-foreground">{entitlement?.total_days?.toLocaleString(i18n.language) ?? "-"}</span>
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}

function ContractorRow({ user, year, onClick }: { user: User, year: number, onClick: () => void }) {
    const { formatDateRange } = useDateFormatter();
    const { t, i18n } = useTranslation();

    const { data: leaves, isLoading } = useQuery({
        queryKey: ["userLeaves", user.id],
        queryFn: () => leavesApi.getUserLeaves(user.id)
    });

    const usedOrPlanned = useMemo(() => {
        return leaves?.filter(req => new Date(req.start_date).getFullYear() === year)
            .reduce((sum, req) => {
                if (['approved', 'pending', 'cancel_pending'].includes(req.status)) {
                    return sum + req.days_count;
                }
                return sum;
            }, 0) || 0;
    }, [leaves, year]);

    const nextAbsence = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return leaves
            ?.filter(r => ["approved", "pending"].includes(r.status))
            .filter(r => parseISO(r.start_date) >= today)
            .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())[0];
    }, [leaves]);

    const pendingCount = useMemo(() => {
        return leaves?.filter(r => r.status === "pending").length || 0;
    }, [leaves]);


    return (
        <TableRow onClick={onClick} className="cursor-pointer hover:bg-muted/5 transition-colors border-muted/10">
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(user.picture)} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.full_name || user.email}</span>
                        {user.full_name && <span className="text-[10px] text-muted-foreground">{user.email}</span>}
                    </div>
                </div>
            </TableCell>
            <TableCell className="text-right font-medium">
                {isLoading ? <Spinner size="sm" className="ml-auto" /> : (
                    <span>{usedOrPlanned.toLocaleString(i18n.language)}</span>
                )}
            </TableCell>
            <TableCell className="text-center text-sm">
                 {isLoading ? <Spinner size="sm" className="mx-auto" /> : (
                     nextAbsence ? (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateRange(nextAbsence.start_date, nextAbsence.end_date)}
                        </div>
                    ) : (
                        <span className="text-muted-foreground/40 text-xs">-</span>
                    )
                )}
            </TableCell>
            <TableCell className="text-center font-medium">
                {isLoading ? <Spinner size="sm" className="mx-auto" /> : (
                    pendingCount > 0 ? (
                         <div className="inline-flex items-center justify-center bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full px-2 py-0.5 text-xs font-bold border border-orange-500/20">
                            {pendingCount}
                         </div>
                    ) : (
                        <span className="text-muted-foreground/40 text-xs">-</span>
                    )
                )}
            </TableCell>
        </TableRow>
    );
}

// Simple cn utility to avoid circular dependency if importing fails or to keep self-contained
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
