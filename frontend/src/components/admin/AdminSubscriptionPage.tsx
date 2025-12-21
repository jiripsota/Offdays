import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBillingStatus, BillingStatus, syncSubscription } from "../../api/billing";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";
import { Skeleton } from "../ui/skeleton";
import { GlassCard, PremiumBadge } from "../ui/premium";

export function AdminSubscriptionPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await getBillingStatus();
      setStatus(data);
    } catch (err) {
      console.error("Failed to load billing status", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncSubscription();
      await loadStatus();
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
    }
  };

  // Determine locale for date-fns
  const dateLocale = i18n.language === "cs" ? cs : enUS;

  // Derived values (safe to calculate only if status exists)
  const usagePercent = status && status.usage.limit > 0 
    ? (status.usage.users / status.usage.limit) * 100 
    : 0;
  
  const isNearLimit = usagePercent >= 80;
  const isOverLimit = status && status.usage.users > status.usage.limit;

  const planNameKey = status?.plan?.id ? `billing.plans.${status.plan.id}` : "";
  const planName = status?.plan ? t(planNameKey, status.plan.id) : t("billing.status_types.trial");

  // Determine Badge variant
  const getBadgeVariant = (statusStr: string) => {
    if (statusStr === "active") return "default";
    if (statusStr === "trial") return "secondary";
    return "destructive";
  };

  if (!loading && !status) {
      return <div className="p-8">Failed to load subscription status.</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-3 md:p-5 space-y-4 bg-background/50">
      {/* Header / Hero Section */}
      <div className="relative">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-xl shadow-inner border-primary/10 group/icon transition-all duration-300">
              <CreditCard className="w-6 h-6 text-primary group-hover/icon:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {t("billing.title")}
              </h1>
              <p className="text-sm text-muted-foreground/80 font-medium">
                {t("billing.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {!loading && status && (isNearLimit || isOverLimit) && (
        <Alert variant={isOverLimit ? "destructive" : "default"} className={isOverLimit ? "border-red-500" : "border-yellow-500"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("billing.alerts.upgrade_needed")}</AlertTitle>
          <AlertDescription>
            {isOverLimit 
              ? t("billing.alerts.upgrade_blocked") 
              : t("billing.alerts.upgrade_suggestion")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan Card */}
        <GlassCard hover={false} className="flex flex-col">
          <CardHeader>
            <CardTitle>{t("billing.current_plan")}</CardTitle>
            <CardDescription>
              {loading ? (
                 <Skeleton className="h-4 w-32 mt-1" />
              ) : (
                <>
                  {t("billing.status")}:{" "}
                  <Badge variant={getBadgeVariant(status!.status)}>
                    {t(`billing.status_types.${status!.status.toLowerCase()}`, status!.status)}
                  </Badge>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
                <div className="space-y-4">
                  <div>
                      <Skeleton className="h-7 w-48 mb-2" /> {/* Plan Name */}
                      <Skeleton className="h-4 w-24" />    {/* Status Detail */}
                  </div>
                  <div className="space-y-2 pt-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="pt-4">
                      <Skeleton className="h-9 w-24" /> {/* Sync Button */}
                  </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                        <h3 className="font-semibold text-lg">{planName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            {status!.status === "expired" && (
                            <span className="text-sm text-destructive font-medium">
                                {t("billing.plan_expired_warning", "Please upgrade to restore access.")}
                            </span>
                            )}
                        </div>
                        </div>
                    </div>
                        
                    <div className="text-sm text-muted-foreground">
                        {status!.trial_ends_at && (
                            <div>{t("billing.trial_ends", { date: format(new Date(status!.trial_ends_at), "PPP", { locale: dateLocale }) })}</div>
                        )}
                        {status!.plan?.cycle && !status!.trial_ends_at && (
                            <div className="capitalize">{status!.plan.cycle} Billing</div>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button variant="outline" onClick={handleSync} disabled={syncing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                            {t("billing.sync")}
                        </Button>
                    </div>
                </>
            )}
          </CardContent>
        </GlassCard>

        {/* Usage Card */}
        <GlassCard hover={false} className="flex flex-col">
          <CardHeader>
             <CardTitle>{t("billing.usage")}</CardTitle>
             <CardDescription>{t("billing.seats")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {loading ? (
                 <div className="space-y-4">
                     <div className="flex justify-between">
                         <Skeleton className="h-4 w-24" />
                         <Skeleton className="h-4 w-12" />
                     </div>
                     <Skeleton className="h-4 w-full" />
                     <Separator className="my-4" />
                     <Skeleton className="h-4 w-64" />
                 </div>
             ) : (
                <>
                    <div className="flex justify-between text-sm">
                        <span>{t("billing.seats_detail", { used: status!.usage.users, limit: status!.usage.limit })}</span>
                        <span className="text-muted-foreground">{Math.round(usagePercent)}%</span>
                    </div>
                    <Progress value={usagePercent} className={isOverLimit ? "bg-red-100 [&>div]:bg-red-500" : ""} />
                    
                    <Separator className="my-4" />
                    
                    <div className="text-sm text-muted-foreground">
                        {t("billing.growth_shield_limit", { limit: status!.usage.hard_limit })}
                    </div>
                </>
             )}
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
}
