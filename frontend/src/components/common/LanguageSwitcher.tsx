import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  collapsed?: boolean;
}

export function LanguageSwitcher({ collapsed }: Props) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language;

  const languageNames: Record<string, string> = {
    en: "English",
    cs: "Čeština",

  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent ${
                collapsed ? "w-auto justify-center px-0" : ""
              }`}
            >
              <Globe className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className="ml-2 truncate">
                  {languageNames[currentLanguage] || "English"}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">{t("language.select")}</TooltipContent>
        )}
      </Tooltip>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "top"}>
        <DropdownMenuItem onClick={() => changeLanguage("en")}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage("cs")}>
          Čeština
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
