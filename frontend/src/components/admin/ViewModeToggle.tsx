import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Users, UserCheck } from "lucide-react";

interface ViewModeToggleProps {
  mode: "all" | "team";
  onChange: (mode: "all" | "team") => void;
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-muted/30">
        <Button 
            variant={mode === "all" ? "default" : "ghost"} 
            size="sm"
            onClick={() => onChange("all")}
            className="text-xs h-7 px-3 gap-2"
        >
            <Users className="h-3.5 w-3.5" />
            {t("admin.view_mode.all", "All")}
        </Button>
        <Button 
            variant={mode === "team" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => onChange("team")}
            className="text-xs h-7 px-3 gap-2"
        >
            <UserCheck className="h-3.5 w-3.5" />
            {t("admin.view_mode.team", "My Team")}
        </Button>
    </div>
  );
}
