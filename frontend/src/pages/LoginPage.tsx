import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { authApi } from "../api/auth";
import { Button } from "@/components/ui/button";
import { SplashScreen } from "@/components/common/SplashScreen";
import logo from "../assets/logo.png";
import { useTranslation, Trans } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Globe, Users } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();
  
  const [showSplash, setShowSplash] = useState(true);
  const errorMsg = searchParams.get("error");

  // Parallax Motion Values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for fluid movement
  const springConfig = { damping: 25, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Map mouse position to subtle movement (max 30px displacement)
  const backgroundX = useTransform(smoothX, [0, 1], [-25, 25]);
  const backgroundY = useTransform(smoothY, [0, 1], [-15, 15]);

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    mouseX.set(x);
    mouseY.set(y);
  };

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
    <div 
      onMouseMove={handleGlobalMouseMove}
      className="w-full h-screen lg:grid lg:grid-cols-2 bg-background select-none"
    >
      {/* Left Panel - Hero/Branding */}
      <div 
        className="hidden lg:flex flex-col justify-between bg-zinc-950 p-16 text-white relative overflow-hidden"
      >
         {/* Background Visual Asset - Single Layer Parallax */}
         <motion.div 
            style={{ x: backgroundX, y: backgroundY, scale: 1.15 }}
            className="absolute inset-0 z-0 pointer-events-none"
         >
            <img 
               src="/src/assets/login-hero.png" 
               alt="" 
               className="w-full h-full object-cover opacity-60"
            />
         </motion.div>

         {/* Soft gradient to maintain readability */}
         <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent z-[1]" />
         
         {/* Top branding area - PROMINENT but balanced */}
         <div className="flex items-center gap-6 relative z-10">
             <img src={logo} alt="Offdays Logo" className="h-16 w-16 drop-shadow-xl" />
             <span className="text-4xl font-black tracking-tighter">
             <span className="text-white">Off</span>
             <span className="text-primary font-bold">days</span>
          </span>
         </div>

         {/* Central marketing content - BALANCED SCALE */}
         <div className="relative z-10 space-y-6 max-w-lg self-start">
            <h2 className="text-5xl font-black leading-tight tracking-tight text-white drop-shadow-lg">
               {t("auth.hero_title")}
            </h2>
            <p className="text-zinc-100 text-lg leading-relaxed font-semibold max-w-md drop-shadow-sm opacity-90">
               {t("auth.hero_subtitle")}
            </p>
         </div>

         {/* Bottom features line - COMPACT */}
         <div className="relative z-10 flex flex-wrap gap-4 text-xs text-zinc-100 font-bold uppercase tracking-widest pt-8">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
               <Globe className="h-4 w-4 text-primary" /> {t("auth.feature_security")}
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
               <Users className="h-4 w-4 text-primary" /> {t("auth.feature_encryption")}
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