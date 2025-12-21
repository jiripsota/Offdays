import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
       {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[100px]" />
        </div>

      <div className="relative z-10 w-full max-w-md px-4 text-center">
         <div className="mb-8 relative inline-block">
             <div className="text-[120px] font-bold text-primary/10 leading-none select-none">404</div>
             <div className="absolute inset-0 flex items-center justify-center">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("not_found.title")}</h1>
             </div>
         </div>
         
        <div className="space-y-6">
          <p className="text-muted-foreground text-lg max-w-xs mx-auto leading-relaxed">
            {t("not_found.description")}
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 shadow-lg hover:shadow-primary/20 transition-all hover:-translate-y-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/`);
            }}
          >
            {t("not_found.back_home")}
          </Button>
        </div>
      </div>
    </div>
  );
}