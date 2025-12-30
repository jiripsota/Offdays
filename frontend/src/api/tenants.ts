export interface Tenant {
    id: number;
    domain: string;
    shared_calendar_id: string | null;
    default_vacation_days: number;
    service_account_email: string | null;
    created_at: string;
}

export const tenantsApi = {
    me: async (): Promise<Tenant> => {
        const res = await fetch("/api/tenants/me", {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed to fetch tenant settings");
        return res.json();
    },
    update: async (data: Partial<Tenant>): Promise<Tenant> => {
        const res = await fetch("/api/tenants/me", {
            method: "PATCH",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Failed to update tenant settings");
        return res.json();
    },
    sync: async (): Promise<{ synchronized: number; errors: number; message: string | null }> => {
        const res = await fetch("/api/tenants/me/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed to sync calendar");
        return res.json();
    }
};
