import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export function useDateFormatter() {
  const { i18n } = useTranslation();

  // Helper to ensure date strings from backend (which are in UTC) are parsed correctly
  const parseDate = (date: string | Date | number): Date => {
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);
    
    // If it's a string that looks like ISO format but missing timezone info,
    // assume it's UTC and add 'Z'
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(date) && !date.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(date)) {
      return new Date(date + 'Z');
    }
    
    return new Date(date);
  };

  const formatDate = useCallback((date: string | Date | number | null | undefined) => {
    if (!date) return "-";
    const d = parseDate(date);
    if (isNaN(d.getTime())) return "-";
    
    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
    }).format(d);
  }, [i18n.language]);

  const formatDateTime = useCallback((date: string | Date | number | null | undefined) => {
    if (!date) return "-";
    const d = parseDate(date);
    if (isNaN(d.getTime())) return "-";

    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(d);
  }, [i18n.language]);

  const formatDateRange = useCallback((startDate: string | Date | number, endDate: string | Date | number) => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
    });

    if (start.toDateString() === end.toDateString()) {
        return formatter.format(start);
    }

    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }, [i18n.language]);

  return { formatDate, formatDateTime, formatDateRange };
}
