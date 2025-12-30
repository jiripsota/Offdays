import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, differenceInBusinessDays, addDays, isWeekend, eachDayOfInterval, isSameDay } from "date-fns";
import { cs } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, AlertTriangle, CalendarDays, Briefcase, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

// Simple CZ Holiday list for frontend preview
const CZ_HOLIDAYS = [
    { m: 0, d: 1 },   // Nový rok
    { m: 4, d: 1 },   // Svátek práce
    { m: 4, d: 8 },   // Den vítězství
    { m: 6, d: 5 },   // Cyril/Metod
    { m: 6, d: 6 },   // Jan Hus
    { m: 8, d: 28 },  // Den české státnosti
    { m: 9, d: 28 },  // Vznik ČSR
    { m: 10, d: 17 }, // Den boje za svobodu
    { m: 11, d: 24 }, // Štědrý den
    { m: 11, d: 25 },
    { m: 11, d: 26 },
];

const isCZHoliday = (date: Date) => {
    return CZ_HOLIDAYS.some(h => date.getMonth() === h.m && date.getDate() === h.d);
};

interface RequestLeaveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  entitlement?: {
    remaining_days: number;
    total_days: number;
  };
  remainingDays?: number;
}

export function RequestLeaveSheet({ open, onOpenChange, onSuccess, entitlement, remainingDays }: RequestLeaveSheetProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  // Date-fns locale
  const dateLocale = i18n.language === 'cs' ? cs : undefined;
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [startHalfDay, setStartHalfDay] = useState(false);
  const [endHalfDay, setEndHalfDay] = useState(false);
  
  const { data: requests } = useQuery({
      queryKey: ["my-requests"],
      queryFn: async () => {
          const res = await fetch("/api/leaves/me/requests", {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (!res.ok) throw new Error("Failed");
          return res.json();
      }
  });

  const isDayInRequests = (date: Date, statuses: string[]) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return requests?.some((req: any) => 
          statuses.includes(req.status) &&
          dateStr >= req.start_date && 
          dateStr <= req.end_date
      );
  };

  const calculateDays = (start: Date, end: Date) => {
      const days = eachDayOfInterval({ start, end });
      
      // Filter out days that are already APPROVED
      const effectiveDays = days.filter(d => !isDayInRequests(d, ["approved"]));
      
      const total = effectiveDays.length;
      const business = effectiveDays.filter(d => !isWeekend(d) && !isCZHoliday(d)).length;
      return { total, business };
  };

  let { total: totalDays, business: baseBusinessDays } = dateRange?.from && dateRange?.to 
    ? calculateDays(dateRange.from, dateRange.to)
    : { total: 0, business: 0 };

  const isStartWorking = dateRange?.from ? !isWeekend(dateRange.from) && !isCZHoliday(dateRange.from) : false;
  const isEndWorking = dateRange?.to ? !isWeekend(dateRange.to) && !isCZHoliday(dateRange.to) : false;

  // Auto-reset half days if dates change to non-working
  useEffect(() => {
      if (!isStartWorking && startHalfDay) setStartHalfDay(false);
      if (!isEndWorking && endHalfDay) setEndHalfDay(false);
  }, [dateRange, isStartWorking, isEndWorking]);

  let businessDays = baseBusinessDays;
  if (startHalfDay && businessDays > 0) {
      businessDays -= 0.5;
      totalDays = Math.max(0, totalDays - 0.5);
  }
  if (endHalfDay && businessDays > 0 && (!isSameDay(dateRange?.from!, dateRange?.to!) || !startHalfDay)) {
      businessDays -= 0.5;
      totalDays = Math.max(0, totalDays - 0.5);
  }

  // Use passed remainingDays or fallback to entitlement logic (though entitlement might be stale if pending not counted)
  // But typically passed remainingDays is the accurate one.
  const limit = remainingDays ?? entitlement?.remaining_days;
  const isOverEntitlement = limit !== undefined && businessDays > limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange?.from || !dateRange?.to) return;
    
    setIsLoading(true);
    try {
        const res = await fetch("/api/leaves/request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                start_date: format(dateRange.from, "yyyy-MM-dd"),
                end_date: format(dateRange.to, "yyyy-MM-dd"),
                start_half_day: startHalfDay,
                end_half_day: endHalfDay,
                note
            })
        });
        
        if (!res.ok) throw new Error("Failed to submit request");
        
        toast({
            title: t("leaves.request_submitted", "Request submitted"),
            description: t("leaves.request_submitted_desc", "Your request is pending approval."),
        });
        onOpenChange(false);
        onSuccess();
        setDateRange(undefined);
        setStartHalfDay(false);
        setEndHalfDay(false);
        setNote("");
    } catch (err) {
        console.error(err);
        toast({
            variant: "destructive",
            title: t("common.error"),
            description: t("leaves.request_failed", "Failed to submit request"),
        });
    } finally {
        setIsLoading(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[700px] sm:max-w-2xl p-0 flex flex-col h-full bg-background/95 backdrop-blur-md" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-6 py-6 border-b border-border/40 flex-row items-center gap-4 space-y-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <CalendarPlus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg font-bold truncate leading-tight">
              {t("leaves.new_request", "New Leave Request")}
            </SheetTitle>
            <p className="text-xs text-muted-foreground truncate opacity-70">
              {t("leaves.new_request_desc", "Select the dates for your leave. Your supervisor will review the request.")}
            </p>
          </div>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                
                {/* Warning */}
                {isOverEntitlement && (
                    <Alert className="border-yellow-500/50 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle className="h-4 w-4 stroke-yellow-500" />
                        <AlertTitle className="font-bold">{t("leaves.over_limit_title", "Warning")}</AlertTitle>
                        <AlertDescription className="text-sm opacity-90">
                            {t("leaves.over_limit_msg", "This request exceeds your remaining entitlement.")}
                            <div className="mt-1 font-bold">
                                    {t("leaves.available")}: {limit?.toLocaleString(i18n.language)} {t("common.days")}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Calendar Section */}
                    <div className="flex-1">
                        <Label className="text-base font-semibold text-foreground/80 mb-3 block">{t("leaves.select_on_calendar", "Select dates on calendar")}</Label>
                        
                        <div className="border border-muted/30 rounded-2xl p-4 flex justify-center bg-card shadow-sm">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                disabled={{ before: new Date() }}
                                locale={dateLocale}
                                modifiers={{
                                    weekend: (date) => isWeekend(date),
                                    holiday: (date) => isCZHoliday(date),
                                    approved: (date) => isDayInRequests(date, ["approved"]),
                                    pending: (date) => isDayInRequests(date, ["pending", "cancel_pending"])
                                }}
                                modifiersClassNames={{
                                    weekend: "text-red-500/80 font-medium",
                                    holiday: "text-red-600 font-bold decoration-red-600/30 underline underline-offset-4",
                                    approved: "bg-emerald-500/10 text-emerald-700 font-bold hover:bg-emerald-500/20",
                                    pending: "bg-amber-500/10 text-amber-700 font-medium hover:bg-amber-500/20"
                                }}
                                className="rounded-md border-0"
                            />
                        </div>

                         {/* Legend - Moved below calendar */}
                         <div className="flex justify-center gap-6 mt-4 text-[10px] font-medium uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500" />
                                <span className="text-muted-foreground">{t("status.approved")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500" />
                                <span className="text-muted-foreground">{t("status.pending")}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section - Narrower & Aligned */}
                    <div className="w-full md:w-[200px] flex flex-col gap-4 mt-9">
                         {/* Stats & Toggles Container - Sticky */}
                        <div className="bg-muted/20 rounded-xl p-4 border border-muted/20 space-y-4 sticky top-0">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("leaves.total_days_label")}</span>
                                </div>
                                <span className="text-3xl font-bold text-foreground">{totalDays.toLocaleString(i18n.language)}</span>
                            </div>
                            
                            <div className="h-px bg-border/50" />

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Briefcase className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">{t("leaves.working_days_label")}</span>
                                </div>
                                <span className="text-3xl font-bold text-primary">{businessDays.toLocaleString(i18n.language)}</span>
                            </div>

                            {/* Half Day Toggles (Sidebar) */}
                            {dateRange?.from && dateRange?.to && (
                                <>
                                    <div className="h-px bg-border/50" />
                                    <div className="space-y-3 pt-2">
                                        {isSameDay(dateRange.from, dateRange.to) ? (
                                            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-muted/30">
                                                <Switch 
                                                    id="half-day" 
                                                    checked={startHalfDay}
                                                    disabled={!isStartWorking}
                                                    onCheckedChange={(c) => {
                                                        setStartHalfDay(c); 
                                                        setEndHalfDay(false);
                                                    }} 
                                                />
                                                <Label htmlFor="half-day" className="cursor-pointer text-sm font-medium">{t("leaves.half_day", "Half day (0.5)")}</Label>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-muted/30">
                                                    <Switch id="start-half" checked={startHalfDay} disabled={!isStartWorking} onCheckedChange={setStartHalfDay} />
                                                    <Label htmlFor="start-half" className="cursor-pointer text-sm font-medium">{t("leaves.half_day_start", "Start half day")}</Label>
                                                </div>
                                                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-muted/30">
                                                    <Switch id="end-half" checked={endHalfDay} disabled={!isEndWorking} onCheckedChange={setEndHalfDay} />
                                                    <Label htmlFor="end-half" className="cursor-pointer text-sm font-medium">{t("leaves.half_day_end", "End half day")}</Label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>





                {/* Note Section - Full Width at Bottom */}
                <div className="space-y-2 pt-2">
                    <Label className="text-base font-semibold text-foreground/80">{t("leaves.note")}</Label>
                    <Textarea 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("leaves.note_placeholder", "e.g. Vacation in Italy")}
                        className="min-h-[100px] resize-none focus-visible:ring-offset-0"
                    />
                </div>
            </div>

            {/* Sticky Footer with Shadow */}
            <div className="p-6 bg-background mt-auto z-50 flex justify-end relative">
                <div className="absolute left-0 right-0 bottom-full h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                 <Button 
                    type="submit" 
                    size="lg"
                    disabled={isLoading || !dateRange?.from || !dateRange?.to || businessDays <= 0} 
                    className="w-full sm:w-auto min-w-[200px] rounded-2xl font-bold h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
                >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("common.submit", "Submit Request")}
                </Button>
            </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
