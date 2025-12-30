import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { authApi } from "../api/auth";
import { Button } from "@/components/ui/button";
import { SplashScreen } from "@/components/common/SplashScreen";
import logo from "../assets/logo.png";
import { useTranslation, Trans } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ShieldCheck, Lock, Globe } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();
  
  const [showSplash, setShowSplash] = useState(true);

  const errorMsg = searchParams.get("error");

  useEffect(() => {
    const timer = setTimeout(() => {
        setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSplash && !isLoading && user) {
      navigate("/");
    }
  }, [showSplash, isLoading, user, navigate]);

  const handleSignIn = async () => {
    try {
      // If we were redirected back with "consent_required", force consent on next try
      const forceConsent = errorMsg === "consent_required";
      const { login_url } = await authApi.getLoginUrl(forceConsent);
      window.location.href = login_url;
    } catch (err) {
      console.error(err);
      alert(t("auth.login_failed"));
    }
  };

  if (showSplash || isLoading) {
    return <SplashScreen />;
  }

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2 bg-background">
      {/* Left Panel - Hero/Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 dark:bg-zinc-950 p-12 text-white relative overflow-hidden">
         {/* Background pattern */}
         <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
               <path d="M0 100 C 20 0 50 0 100 100 Z" fill="currentColor" />
            </svg>
         </div>

         {/* Logo Area */}
         <div className="flex items-center gap-3 relative z-10">
             <img src={logo} alt="Offdays Logo" className="h-10 w-10" />
             <span className="text-2xl font-bold tracking-tight">
               <span className="text-white">Off</span>
               <span className="text-[#0ECDBF]">days</span>
             </span>
         </div>

         {/* Hero Content */}
         <div className="relative z-10 space-y-6 max-w-md">
            <h2 className="text-4xl font-bold leading-tight">
               {t("auth.hero_title")}
            </h2>
            <p className="text-zinc-400 text-lg">
               {t("auth.hero_subtitle")}
            </p>
         </div>

         {/* Features / Footer */}
         <div className="relative z-10 flex gap-6 text-sm text-zinc-500 font-medium">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-4 w-4" /> {t("auth.feature_security")}
            </div>
            <div className="flex items-center gap-2">
               <Lock className="h-4 w-4" /> {t("auth.feature_encryption")}
            </div>
         </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex items-center justify-center p-8 bg-background relative">
         <div className="w-full max-w-sm space-y-8">
            
            {/* Mobile Logo (only visible on small screens) */}
            <div className="lg:hidden flex justify-center mb-8">
                 <img src={logo} alt="Vaultiqo Logo" className="h-12 w-12" />
            </div>

            <div className="text-center space-y-2">
               <h1 className="text-2xl font-semibold tracking-tight">
                  {t("auth.login_title")}
               </h1>
               <p className="text-sm text-muted-foreground">
                  {t("auth.login_subtitle")}
               </p>
            </div>

            {errorMsg && (
                <Alert
                variant="destructive"
                className="border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="space-y-1">
                    <AlertTitle className="text-sm font-semibold">
                      {t("common.error")}
                    </AlertTitle>
                    <AlertDescription className="text-sm opacity-90">
                      {/* Special handling for consent_required to show a friendly message */}
                      {errorMsg === "consent_required" 
                        ? t("auth.error_consent_required", { defaultValue: "Please grant the requested permissions to continue." })
                        : t(`auth.${errorMsg}`, { defaultValue: errorMsg })
                      }
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            <div className="space-y-4 pt-4">
                <Button
                  onClick={handleSignIn}
                  className="w-full h-11 text-base font-medium shadow-sm"
                  size="lg"
                >
                   <Globe className="mr-2 h-4 w-4" />
                  {errorMsg === "consent_required" ? t("auth.grant_permissions", { defaultValue: "Grant Permissions" }) : t("auth.login_button")}
                </Button>
                
                 <div className="text-xs text-center text-muted-foreground px-4 leading-relaxed">
                    <Trans 
                      i18nKey="auth.legal_agreement"
                      components={{
                        terms: <a href="https://www.vaultiqo.app/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary underline-offset-4" />,
                        privacy: <a href="https://www.vaultiqo.app/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary underline-offset-4" />
                      }}
                    />
                </div>
            </div>

             <div className="text-center">
                 <p className="text-xs text-muted-foreground/50">
                     &copy; {new Date().getFullYear()} Vaultiqo. All rights reserved.
                 </p>
             </div>
         </div>
      </div>
    </div>
  );
}