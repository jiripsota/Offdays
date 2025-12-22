import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format, differenceInBusinessDays, addDays, isWeekend, eachDayOfInterval, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, AlertTriangle, CalendarDays, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
}

export function RequestLeaveSheet({ open, onOpenChange, onSuccess, entitlement }: RequestLeaveSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const calculateDays = (start: Date, end: Date) => {
      const days = eachDayOfInterval({ start, end });
      const total = days.length;
      const business = days.filter(d => !isWeekend(d) && !isCZHoliday(d)).length;
      return { total, business };
  };

  const { total: totalDays, business: businessDays } = dateRange?.from && dateRange?.to 
    ? calculateDays(dateRange.from, dateRange.to)
    : { total: 0, business: 0 };

  const isOverEntitlement = entitlement && businessDays > entitlement.remaining_days;

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
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col h-full bg-background/95 backdrop-blur-md">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold tracking-tight">{t("leaves.new_request", "New Leave Request")}</SheetTitle>
          <SheetDescription>
            {t("leaves.new_request_desc", "Select the dates for your leave. Your supervisor will review the request.")}
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6 mt-8 overflow-y-auto pr-2">
            
            <div className="space-y-4">
                <Label className="text-base font-semibold text-foreground/80">{t("leaves.select_on_calendar", "Select dates on calendar")}</Label>
                <div className="border border-muted/30 rounded-2xl p-4 flex justify-center bg-card shadow-sm">
                    <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        disabled={{ before: new Date() }}
                        modifiers={{
                            weekend: (date) => isWeekend(date),
                            holiday: (date) => isCZHoliday(date)
                        }}
                        modifiersClassNames={{
                            weekend: "text-red-500/80 font-medium",
                            holiday: "text-red-600 font-bold decoration-red-600/30 underline underline-offset-4"
                        }}
                        className="rounded-md border-0"
                    />
                </div>
            </div>
            
            {totalDays > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-4 rounded-2xl border border-muted/20 flex flex-col items-center justify-center text-center">
                            <CalendarDays className="h-5 w-5 text-muted-foreground mb-1" />
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t("leaves.total_days_label", "Total Days")}</div>
                            <div className="text-2xl font-bold text-foreground">{totalDays}</div>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex flex-col items-center justify-center text-center">
                            <Briefcase className="h-5 w-5 text-primary mb-1" />
                            <div className="text-xs font-medium text-primary uppercase tracking-widest">{t("leaves.working_days_label", "Working Days")}</div>
                            <div className="text-2xl font-bold text-primary">{businessDays}</div>
                        </div>
                    </div>

                    {isOverEntitlement && (
                        <Alert className="border-yellow-500/50 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 rounded-2xl">
                            <AlertTriangle className="h-4 w-4 stroke-yellow-500" />
                            <AlertTitle className="font-bold">{t("leaves.over_limit_title", "Warning")}</AlertTitle>
                            <AlertDescription className="text-sm opacity-90">
                                {t("leaves.over_limit_msg", "This request exceeds your remaining entitlement.")}
                                <div className="mt-1 font-bold">
                                     {t("leaves.available")}: {entitlement?.remaining_days} {t("common.days")}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <Label className="text-base font-semibold text-foreground/80">{t("leaves.note", "Note (Optional)")}</Label>
                <Textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("leaves.note_placeholder", "e.g. Vacation in Italy")}
                    className="min-h-[100px] rounded-2xl border-muted/30 focus:ring-primary/20 transition-all shadow-sm"
                />
            </div>

            <div className="mt-auto pt-6 border-t border-muted/10">
                 <Button 
                    type="submit" 
                    size="lg"
                    disabled={isLoading || !dateRange?.from || !dateRange?.to} 
                    className="w-full rounded-2xl font-bold h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
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
