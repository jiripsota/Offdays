import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { tenantsApi } from "@/api/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/premium";
import { useToast } from "@/hooks/use-toast";
import { Settings, Calendar, Save, Loader2, RefreshCw, ExternalLink } from "lucide-react";

export function SettingsPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [calendarId, setCalendarId] = useState("");
    const [defaultVacationDays, setDefaultVacationDays] = useState(20);

    const { data: tenant, isLoading } = useQuery({
        queryKey: ["tenant"],
        queryFn: async () => {
            const data = await tenantsApi.me();
            setCalendarId(data.shared_calendar_id || "");
            setDefaultVacationDays(data.default_vacation_days);
            return data;
        }
    });

    const mutation = useMutation({
        mutationFn: (data: { shared_calendar_id?: string; default_vacation_days?: number }) => tenantsApi.update(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tenant"] });
            toast({
                title: t("common.success", "Success"),
                description: t("common.saved", "Settings saved successfully."),
            });
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: t("common.error", "Error"),
                description: t("common.error_desc", "Failed to save settings."),
            });
        }
    });

    const syncMutation = useMutation({
        mutationFn: () => tenantsApi.sync(),
        onSuccess: (data) => {
            if (data.errors > 0) {
                toast({
                    variant: "destructive",
                    title: t("settings.sync_partial", "Sync completed with errors"),
                    description: (
                        <div className="break-all text-xs opacity-90 max-w-[320px]">
                            {data.message || t("settings.sync_error", "Some events could not be synchronized.")}
                        </div>
                    ),
                });
            } else {
                toast({
                    title: t("settings.sync_success", "Sync completed"),
                    description: t("settings.sync_success_desc", "Successfully synchronized {{count}} events.", { count: data.synchronized }),
                });
            }
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: t("common.error", "Error"),
                description: t("settings.sync_error", "Failed to synchronize calendar."),
            });
        }
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const hasChanges = calendarId !== (tenant?.shared_calendar_id || "") || defaultVacationDays !== tenant?.default_vacation_days;

    return (
        <div className="flex-1 w-full p-6 space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Settings className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("settings.title", "Organization Settings")}</h1>
                    <p className="text-muted-foreground">{t("settings.subtitle", "Manage company-wide preferences and integrations.")}</p>
                </div>
                <div className="ml-auto">
                    <Button 
                        size="lg"
                        className="px-8 shadow-sm"
                        onClick={() => mutation.mutate({ shared_calendar_id: calendarId, default_vacation_days: defaultVacationDays })}
                        disabled={mutation.isPending || !hasChanges}
                    >
                        {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                        {t("common.save", "Save Changes")}
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {/* General Settings */}
                <GlassCard className="p-8" hover={false}>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 text-xl font-semibold">
                            <Settings className="h-6 w-6 text-primary" />
                            <h2>{t("settings.general", "General Settings")}</h2>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                            <div className="space-y-2">
                                <Label htmlFor="default-vacation" className="text-base font-medium">
                                    {t("settings.default_vacation_days", "Standard annual vacation allowance")}
                                </Label>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="default-vacation"
                                        type="number"
                                        value={defaultVacationDays}
                                        onChange={(e) => setDefaultVacationDays(parseInt(e.target.value) || 0)}
                                        className="max-w-[120px] text-lg font-bold h-12"
                                    />
                                    <span className="text-muted-foreground font-medium">{t("common.days", "days")}</span>
                                </div>
                                <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/10">
                                    {t("settings.default_vacation_days_desc", "This number of days will be set as the standard allowance for all employees in the company.")}
                                </p>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Google Calendar Integration */}
                <GlassCard className="p-8" hover={false}>
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xl font-semibold">
                                <Calendar className="h-6 w-6 text-primary" />
                                <h2>{t("settings.google_calendar", "Google Calendar Integration")}</h2>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={() => syncMutation.mutate()} 
                                disabled={syncMutation.isPending}
                                className="hover:bg-primary/5 border-primary/20"
                            >
                                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                {t("settings.sync_now", "Synchronize All")}
                            </Button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2 max-w-2xl">
                                <Label htmlFor="calendar-id" className="text-base font-medium">
                                    {t("settings.shared_calendar_id", "Shared Calendar ID")}
                                </Label>
                                <Input
                                    id="calendar-id"
                                    value={calendarId}
                                    onChange={(e) => setCalendarId(e.target.value)}
                                    placeholder="example@group.calendar.google.com"
                                    className="w-full font-mono text-sm h-11"
                                />
                            </div>

                            <div className="space-y-4 p-6 bg-primary/5 rounded-xl border border-primary/10">
                                <h3 className="font-semibold text-base flex items-center gap-2 text-primary">
                                    <Settings className="h-5 w-5" />
                                    {t("settings.setup_steps", "Setup Instructions")}
                                </h3>
                                <ol className="text-sm space-y-4 list-decimal list-inside text-muted-foreground">
                                    <li className="pl-2">
                                        <a 
                                            href="https://console.cloud.google.com/apis/library/calendar.googleapis.com" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                                        >
                                            {t("settings.step_enable_api", "Enable Google Calendar API")}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                        <p className="ml-7 mt-1 text-xs opacity-75">{t("settings.step_enable_api_desc", "This must be done in the Google Cloud project where your service account was created.")}</p>
                                    </li>
                                    <li className="pl-2">
                                        <span className="font-medium text-foreground">{t("settings.step_share_calendar", "Share your calendar with the service account:")}</span>
                                        {tenant?.service_account_email && (
                                            <div className="ml-7 mt-2">
                                                <code className="bg-primary/10 px-3 py-1.5 rounded-lg text-primary font-bold border border-primary/20 select-all">
                                                    {tenant.service_account_email}
                                                </code>
                                            </div>
                                        )}
                                        <p className="ml-7 mt-2 text-xs opacity-75">{t("settings.step_share_calendar_desc", "In Google Calendar settings, add this email and give it 'Make changes to events' permission.")}</p>
                                    </li>
                                    <li className="pl-2">
                                        <span className="font-medium text-foreground">{t("settings.step_enter_id", "Enter the Calendar ID above and Save.")}</span>
                                    </li>
                                </ol>
                            </div>

                            <p className="text-sm text-balance text-muted-foreground mt-4 italic opacity-80">
                                {tenant?.service_account_email ? (
                                    <span>
                                        {t("settings.calendar_hint_sa", "All approved absences will be automatically synced to this calendar. Ensure that you have shared this calendar with the service account:")}{" "}
                                        <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold underline underline-offset-4">{tenant.service_account_email}</code>{" "}
                                        {t("settings.calendar_hint_sa_access", "(give it 'Make changes to events' access).")}
                                    </span>
                                ) : (
                                    t("settings.calendar_hint", "All approved absences will be automatically synced to this calendar. Ensure that the service account has write access to this calendar.")
                                )}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
