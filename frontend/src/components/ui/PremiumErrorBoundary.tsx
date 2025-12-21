import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, RefreshCw, Home, ShieldAlert } from "lucide-react";
import { Button } from "./button";
import { GlassCard } from "./premium";
import { cn } from "@/lib/utils";

export function PremiumErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = "An unexpected error occurred.";
  let errorStatus = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || error.data?.message || errorMessage;
    errorStatus = error.status.toString();
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-destructive/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <GlassCard className="max-w-xl w-full p-8 md:p-10 border-destructive/10 shadow-xl space-y-6 relative z-10" hover={false}>
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Offdays ran into a problem</h1>
            <p className="text-muted-foreground text-lg font-medium opacity-80">
              We encountered an unexpected error while processing your request.
            </p>
          </div>

          <div className="w-full p-4 rounded-2xl bg-muted/30 border border-muted/20 font-mono text-sm overflow-auto max-h-40 text-left">
            <div className="flex items-center gap-2 mb-2 text-destructive/70 font-bold uppercase text-[10px] tracking-widest">
              <AlertCircle className="h-3 w-3" />
              Error Details {errorStatus && `[Status: ${errorStatus}]`}
            </div>
            <div className="text-foreground/70 break-words line-clamp-4">
              {errorMessage}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button
              variant="default"
              size="lg"
              onClick={handleRetry}
              className="rounded-xl px-8 shadow-md shadow-primary/10 transition-all hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Now
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleGoBack}
              className="rounded-xl px-8 bg-background/50 border-muted/20 hover:bg-muted/5 transition-all"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={handleGoHome}
              className="rounded-xl px-8 hover:bg-muted/10 transition-all"
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-30 text-[10px] font-bold uppercase tracking-[0.3em] pointer-events-none">
        Vaultiqo Reliability Engine
      </div>
    </div>
  );
}
