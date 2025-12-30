import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isWeekend,
  parseISO
} from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { leavesApi, LeaveRequest } from "../api/leaves";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Info 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassCard } from "../components/ui/premium";
import { getAvatarUrl } from "../utils/avatarUrl";
import { Spinner } from "@/components/ui/spinner";

export function CalendarPage() {
    const { t, i18n } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const locale = i18n.language === "cs" ? cs : enUS;

    const { data: requests, isLoading } = useQuery({
        queryKey: ["teamCalendar"],
        queryFn: () => leavesApi.getCalendar()
    });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const getInitials = (name?: string | null, email?: string) => {
        if (name) {
            return name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
        }
        return email?.charAt(0).toUpperCase() || "?";
    };

    const getRequestsForDay = (day: Date) => {
        if (!requests) return [];
        return requests.filter(req => {
            const start = parseISO(req.start_date);
            const end = parseISO(req.end_date);
            // Treat as inclusive dates
            return day >= start && day <= end;
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="xl" />
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <CalendarIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {t("calendar.title", "Calendar")}
                            <span className="text-muted-foreground ml-3 font-light capitalize">
                                {i18n.language === 'cs' 
                                    ? format(currentDate, "LLLL yyyy", { locale }) 
                                    : format(currentDate, "MMMM yyyy", { locale })}
                            </span>
                        </h1>
                        <p className="text-muted-foreground">
                            {t("calendar.subtitle", "Team overview of vacations and absences.")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                        {t("common.today", "Today")}
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <GlassCard className="p-1 overflow-hidden" hover={false}>
                <div className="grid grid-cols-7 border-b border-muted/20">
                    {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                        <div key={day} className="p-4 text-center text-sm font-bold text-muted-foreground uppercase tracking-widest">
                            {t(`common.days_full.${day}`, day.substring(0, 3))}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
                    {calendarDays.map((day, idx) => {
                        const dayRequests = getRequestsForDay(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isToday = isSameDay(day, new Date());
                        const isDayWeekend = isWeekend(day);

                        return (
                            <div 
                                key={day.toString()} 
                                className={cn(
                                    "p-2 border-r border-b border-muted/10 transition-colors relative min-h-[120px]",
                                    !isCurrentMonth && "opacity-30 bg-muted/5",
                                    isToday && "bg-primary/5",
                                    isDayWeekend && isCurrentMonth && "bg-muted/10",
                                    idx % 7 === 6 && "border-r-0"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                        "text-sm font-semibold",
                                        isToday ? "text-primary px-2 py-0.5 bg-primary/20 rounded-full" : "text-muted-foreground"
                                    )}>
                                        {format(day, "d")}
                                    </span>
                                </div>
                                
                                <div className="flex flex-wrap gap-1 mt-2">
                                    <TooltipProvider>
                                        <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300">
                                            {dayRequests.map((req, ridx) => (
                                                <Tooltip key={req.id + idx}>
                                                    <TooltipTrigger asChild>
                                                        <div 
                                                            className="relative"
                                                            style={{ zIndex: 10 + ridx }}
                                                        >
                                                            <Avatar className="h-8 w-8 border-2 border-background shadow-sm hover:scale-110 transition-transform cursor-pointer">
                                                                <AvatarImage src={getAvatarUrl(req.user?.picture)} />
                                                                <AvatarFallback className="bg-slate-800 text-primary text-[10px] font-bold">
                                                                    {getInitials(req.user?.full_name, req.user?.email)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        <div className="text-xs font-semibold">
                                                            {req.user?.full_name || req.user?.email}
                                                        </div>
                                                        <div className="text-[10px] opacity-70">
                                                            {req.note || t("leaves.vacation", "Vacation")}
                                                        </div>
                                                        <div className="text-[10px] font-medium text-primary/80 mt-1 uppercase tracking-tighter">
                                                            {format(parseISO(req.start_date), "d. M. yyyy")} – {format(parseISO(req.end_date), "d. M. yyyy")}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </TooltipProvider>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>
        </div>
    );
}

// Helper for class names since I don't want to import it from utils yet
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
