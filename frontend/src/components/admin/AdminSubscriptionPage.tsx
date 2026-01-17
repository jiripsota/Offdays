import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBillingStatus, BillingStatus, syncSubscription } from "../../api/billing";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { CreditCard, AlertCircle } from "lucide-react";
import { useDateFormatter } from "../../hooks/useDateFormatter";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";
import { Skeleton } from "../ui/skeleton";
import { GlassCard, PremiumBadge } from "../ui/premium";

export function AdminSubscriptionPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

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



  // Determine locale for date-fns
  const { formatDate } = useDateFormatter();

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
      return <div className="p-8">{t("billing.failed_load")}</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-8 bg-background/50">
      {/* Header / Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl shadow-inner border-primary/10 group/icon transition-all duration-300">
              <CreditCard className="w-8 h-8 text-primary group-hover/icon:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {t("billing.title")}
              </h1>
              <p className="text-sm text-muted-foreground/80 font-medium">
                {t("billing.subtitle")}
              </p>
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
                            <div>{t("billing.trial_ends", { date: formatDate(status!.trial_ends_at) })}</div>
                        )}
                        {status!.plan?.cycle && !status!.trial_ends_at && (
                            <div className="capitalize">{status!.plan.cycle} {t("billing.cycle_billing")}</div>
                        )}
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
