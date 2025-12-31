import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { 
    format, 
    startOfYear, 
    endOfYear, 
    eachMonthOfInterval, 
    isSameMonth, 
    parseISO, 
    eachDayOfInterval,
    isWeekend,
    isSameDay,
    startOfMonth,
    endOfMonth,
    isWithinInterval,
    startOfDay
} from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { usersApi, User } from "../../api/users";
import { leavesApi, LeaveRequest } from "../../api/leaves";
import { 
    LayoutDashboard,
    PieChart,
    CheckSquare,
    CalendarDays as CalendarIcon,
    Users,
    Search,
    Clock
} from "lucide-react";
import { useDateFormatter } from "@/hooks/useDateFormatter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "../../components/ui/premium";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getInitials } from "../../utils/avatarUrl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { isCZHoliday } from "@/utils/holidays";

const getCzechDaysLabel = (count: number) => {
    if (count === 1) return "den";
    if (count === 0.5) return "dne";
    if (count >= 2 && count <= 4) return "dny";
    return "dní";
};

export function UserDetailAbsencePage() {
    const { t, i18n } = useTranslation();
    const { formatDateRange } = useDateFormatter();
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const locale = i18n.language === "cs" ? cs : enUS;

    const { data: managedUsers, isLoading: loadingUsers } = useQuery({
        queryKey: ["managedUsers"],
        queryFn: () => usersApi.listManaged()
    });

    const { data: leaveHistory, isLoading: loadingLeaves } = useQuery({
        queryKey: ["userLeaves", selectedUserId],
        queryFn: () => selectedUserId ? leavesApi.getUserLeaves(selectedUserId) : Promise.resolve([]),
        enabled: !!selectedUserId
    });

    const { data: entitlement, isLoading: loadingEntitlement } = useQuery({
        queryKey: ["userEntitlement", selectedUserId, selectedYear],
        queryFn: () => selectedUserId ? leavesApi.getUserEntitlement(selectedUserId, selectedYear) : Promise.resolve(null),
        enabled: !!selectedUserId
    });

    const usedOrPlannedDays = useMemo(() => {
        return leaveHistory?.filter(req => new Date(req.start_date).getFullYear() === selectedYear)
            .reduce((sum, req) => {
                if (['approved', 'pending', 'cancel_pending'].includes(req.status)) {
                    return sum + req.days_count;
                }
                return sum;
            }, 0) || 0;
    }, [leaveHistory, selectedYear]);

    const usedThisMonth = useMemo(() => {
        const now = new Date();
        return leaveHistory?.reduce((sum, req) => {
            const start = parseISO(req.start_date);
            if (['approved', 'pending', 'cancel_pending'].includes(req.status) && 
                start.getMonth() === now.getMonth() &&
                start.getFullYear() === now.getFullYear()) {
                return sum + req.days_count;
            }
            return sum;
        }, 0) || 0;
    }, [leaveHistory]);

    const nextAbsence = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return leaveHistory
            ?.filter(r => ["approved", "pending"].includes(r.status))
            .filter(r => parseISO(r.start_date) >= today)
            .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())[0];
    }, [leaveHistory]);

    const pendingCount = useMemo(() => {
        return leaveHistory?.filter(r => r.status === "pending").length || 0;
    }, [leaveHistory]);

    const selectedUser = useMemo(() => 
        managedUsers?.find(u => u.id === selectedUserId), 
    [managedUsers, selectedUserId]);

    const months = useMemo(() => {
        const yearStart = startOfYear(new Date(selectedYear, 0, 1));
        const yearEnd = endOfYear(yearStart);
        return eachMonthOfInterval({ start: yearStart, end: yearEnd });
    }, [selectedYear]);

    const getRequestsForMonth = (month: Date) => {
        if (!leaveHistory) return [];
        return leaveHistory.filter(req => {
            // Only show approved, pending, or cancel_pending requests (exclude cancelled/rejected)
            if (!['approved', 'pending', 'cancel_pending'].includes(req.status)) {
                return false;
            }
            
            const start = parseISO(req.start_date);
            const end = parseISO(req.end_date);
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            
            // Filter by selected year - only show requests that have days in the selected year
            const yearStart = startOfYear(new Date(selectedYear, 0, 1));
            const yearEnd = endOfYear(yearStart);
            
            // Request must overlap with both the month AND the selected year
            return (start <= monthEnd && end >= monthStart) && 
                   (start <= yearEnd && end >= yearStart);
        });
    };

    if (loadingUsers) return <div className="flex h-full items-center justify-center"><Spinner size="xl" /></div>;

    return (
        <div className="flex-1 w-full p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {t("admin.users.user_absence.title", "Team Overview")}
                        </h1>
                        <p className="text-muted-foreground">
                            {t("admin.users.user_absence.subtitle")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="w-full md:w-[280px] bg-background/50 backdrop-blur-sm border-muted/20">
                            <SelectValue placeholder={t("admin.users.user_absence.select_user", "Select User")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {managedUsers?.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5 shrink-0">
                                            <AvatarImage src={getAvatarUrl(user.picture)} />
                                            <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-semibold">
                                                {getInitials(user.full_name, user.email)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{user.full_name || user.email}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-muted/30">
                        <Button 
                            variant={selectedYear === currentYear ? "default" : "ghost"} 
                            size="sm"
                            onClick={() => setSelectedYear(currentYear)}
                            className="text-xs h-7 px-4"
                        >
                            {currentYear}
                        </Button>
                        <Button 
                            variant={selectedYear === nextYear ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setSelectedYear(nextYear)}
                            className="text-xs h-7 px-4"
                        >
                            {nextYear}
                        </Button>
                    </div>
                </div>
            </div>

            {!selectedUserId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="p-6 bg-muted/20 rounded-full">
                        <Search className="h-12 w-12 text-muted-foreground opacity-20" />
                    </div>
                    <div className="max-w-sm">
                        <h3 className="text-lg font-semibold">{t("admin.users.user_absence.no_user_selected", "No user selected")}</h3>
                        <p className="text-muted-foreground">{t("admin.users.user_absence.select_user_hint", "Please select an employee from the list to view their absence details and statistics.")}</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Stats Grid - Mirrored from Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        
                        {/* Box 1: Used / Planned */}
                        <GlassCard className="p-4 flex flex-col justify-between relative overflow-hidden group h-full" hover={false}>
                            <div className="flex items-start justify-between z-10">
                                <div>
                                    <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                                        {selectedUser?.user_type === "contractor" 
                                            ? t("leaves.used_contractor") 
                                            : t("leaves.used")}
                                    </h3>
                                    <div className="text-3xl font-bold text-foreground">
                                        {usedOrPlannedDays.toLocaleString(i18n.language)}
                                    </div>
                                </div>
                                <div className="p-2 bg-muted rounded-lg text-foreground">
                                    <CheckSquare className="h-5 w-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4 z-10 relative">
                                {selectedUser?.user_type === "contractor" 
                                    ? (selectedYear === new Date().getFullYear() 
                                        ? t("leaves.used_this_month_contractor", { count: usedThisMonth.toLocaleString(i18n.language), unit: i18n.language === 'cs' ? getCzechDaysLabel(usedThisMonth) : t("common.days") })
                                        : "\u00A0")
                                    : t("leaves.used_remaining_desc", { remaining: (entitlement ? entitlement.total_days - usedOrPlannedDays : 0).toLocaleString(i18n.language), unit: i18n.language === 'cs' ? getCzechDaysLabel(entitlement ? entitlement.total_days - usedOrPlannedDays : 0) : t("common.days") })}
                            </p>
                            <div className="absolute -right-4 -bottom-4 bg-muted/50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
                        </GlassCard>

                        {/* Box 2: Next Absence / Leave */}
                        <GlassCard className="p-4 flex flex-col justify-between relative overflow-hidden group h-full" hover={false}>
                            <div className="flex items-start justify-between z-10">
                                <div>
                                    <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                                        {selectedUser?.user_type === "contractor" 
                                            ? t("leaves.next_absence") 
                                            : t("leaves.next_leave")}
                                    </h3>
                                    <div className="text-lg font-bold">
                                        {!nextAbsence ? t("common.none") : formatDateRange(nextAbsence.start_date, nextAbsence.end_date)}
                                    </div>
                                </div>
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <Clock className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 bg-emerald-50/50 dark:bg-emerald-900/10 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
                        </GlassCard>

                        {/* Box 3: Pending Confirmation / Requests */}
                        <GlassCard className="p-4 flex flex-col justify-between relative overflow-hidden group h-full" hover={false}>
                            <div className="flex items-start justify-between z-10">
                                <div>
                                    <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                                        {selectedUser?.user_type === "contractor" 
                                            ? t("leaves.pending_notifications") 
                                            : t("leaves.pending_requests")}
                                    </h3>
                                    <div className="text-3xl font-bold">
                                        {pendingCount}
                                    </div>
                                </div>
                                <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                                    <Clock className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 bg-orange-50/50 dark:bg-orange-900/10 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
                        </GlassCard>

                        {/* Box 4: Accrued / Contractual Allowance (Employee Only) */}
                        {selectedUser?.user_type !== "contractor" ? (
                            <GlassCard className="p-4 flex flex-col justify-between relative overflow-hidden group h-full" hover={false}>
                                <div className="flex items-start justify-between z-10">
                                    <div>
                                        <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("leaves.accrued_total")}</h3>
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                            {entitlement?.accrued_days?.toLocaleString(i18n.language) ?? 0}
                                            <span className="text-muted-foreground/40 font-light mx-2">/</span>
                                            <span className="text-foreground">{entitlement?.total_days?.toLocaleString(i18n.language) ?? 0}</span>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                        <PieChart className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="absolute -right-4 -bottom-4 bg-blue-50 dark:bg-blue-900/10 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-in-out" />
                            </GlassCard>
                        ) : (
                            <div className="hidden md:block" />
                        )}
                    </div>

                    {/* Months Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {months.filter(m => getRequestsForMonth(m).length > 0).map(month => {
                            const monthRequests = getRequestsForMonth(month);
                            
                            // Calculate actual number of BUSINESS days in this month
                            const monthStart = startOfMonth(month);
                            const monthEnd = endOfMonth(month);
                            const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                            
                            const absenceDaysCount = daysInMonth.filter(day => {
                                // Only count business days (exclude weekends and holidays)
                                if (isWeekend(day) || isCZHoliday(day)) {
                                    return false;
                                }
                                
                                const dayStart = startOfDay(day);
                                return monthRequests.some(r => {
                                    const rs = startOfDay(parseISO(r.start_date));
                                    const re = startOfDay(parseISO(r.end_date));
                                    return isWithinInterval(dayStart, { start: rs, end: re });
                                });
                            }).length;
                            
                            return (
                                <GlassCard 
                                    key={month.toString()} 
                                    className="p-4 flex flex-col h-full"
                                    hover={false}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-lg">{i18n.language === "cs" ? format(month, "LLLL", { locale }).toLowerCase() : format(month, "LLLL", { locale })}</h4>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                                            {absenceDaysCount} {i18n.language === "cs" ? (absenceDaysCount === 1 ? "den" : absenceDaysCount >= 2 && absenceDaysCount <= 4 ? "dny" : "dní") : absenceDaysCount === 1 ? "day" : "days"}
                                        </Badge>
                                    </div>

                                    <div className="flex-1">
                                        <MonthGrid month={month} requests={monthRequests} />
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>

                    {months.filter(m => getRequestsForMonth(m).length > 0).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-2xl border border-dashed border-muted/20">
                            <CalendarIcon className="h-10 w-10 text-muted-foreground opacity-20 mb-3" />
                            <p className="text-muted-foreground">{t("admin.users.user_absence.no_absences_this_year", "No absences recorded for this year.")}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function MonthGrid({ month, requests }: { month: Date, requests: LeaveRequest[] }) {
    const { t, i18n } = useTranslation();
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    
    // Calculate prefix days to align properly (assuming week starts on Monday)
    const prefixDays = (start.getDay() + 6) % 7;
    
    // Weekday headers (Monday to Sunday)
    const weekdayHeaders = i18n.language === "cs" 
        ? ["po", "út", "st", "čt", "pá", "so", "ne"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekdayHeaders.map((day, i) => (
                    <div 
                        key={day} 
                        className={cn(
                            "text-center text-[10px] font-medium uppercase tracking-wider",
                            i >= 5 ? "text-red-500/60" : "text-muted-foreground/60"
                        )}
                    >
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: prefixDays }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
                const dayStart = startOfDay(day);
                const isDayWeekend = isWeekend(day);
                const isDayHoliday = isCZHoliday(day);
                
                // Only highlight as absence if it's a business day (not weekend/holiday) AND within a request period
                const isAbsence = !isDayWeekend && !isDayHoliday && requests.some(r => {
                    const rs = startOfDay(parseISO(r.start_date));
                    const re = startOfDay(parseISO(r.end_date));
                    return isWithinInterval(dayStart, { start: rs, end: re });
                });
                
                const isToday = isSameDay(day, new Date());

                return (
                    <TooltipProvider key={day.toString()}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div 
                                    className={cn(
                                        "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-all cursor-default",
                                        // Green for approved leave (business days only)
                                        isAbsence && "bg-emerald-500/20 text-emerald-700 font-bold hover:bg-emerald-500/30",
                                        // Red for weekends and holidays
                                        (isDayWeekend || isDayHoliday) && !isAbsence && "text-red-500/70 font-medium",
                                        // Default for regular business days
                                        !isAbsence && !isDayWeekend && !isDayHoliday && "bg-muted/10 text-muted-foreground",
                                        // Today indicator
                                        isToday && !isAbsence && "border border-primary/50 text-primary"
                                    )}
                                >
                                    {format(day, "d")}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    <p className="font-bold">{format(day, "d. MMMM yyyy")}</p>
                                    {isAbsence && (
                                        <p className="text-emerald-600 dark:text-emerald-400 mt-1">
                                            {requests.find(r => {
                                                const rs = startOfDay(parseISO(r.start_date));
                                                const re = startOfDay(parseISO(r.end_date));
                                                return isWithinInterval(dayStart, { start: rs, end: re });
                                            })?.note || t("leaves.vacation")}
                                        </p>
                                    )}
                                    {isDayHoliday && (
                                        <p className="text-red-600 dark:text-red-400 mt-1">
                                            {t("common.holiday", "Holiday")}
                                        </p>
                                    )}
                                    {isDayWeekend && !isDayHoliday && (
                                        <p className="text-red-500/70 mt-1">
                                            {t("common.weekend", "Weekend")}
                                        </p>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
            </div>
        </div>
    );
}

