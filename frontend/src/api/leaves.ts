import { api } from "./api"; // Assuming a base api wrapper exists, or standard fetch?
// AdminUsersPage used 'usersApi' which likely uses axios or fetch wrapper.
// Let's assume standard fetch wrapper or check `api/users.ts` content first.
// I'll create this file properly after seeing api/users.ts structure.
// For now, placeholder content matching commonly used pattern.

export interface LeaveRequest {
    id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    status: string;
    note?: string;
    user?: {
        id: string;
        full_name: string;
        email: string;
        picture?: string;
    };
}

export interface LeaveEntitlement {
    id: number;
    user_id: string;
    year: number;
    total_days: number;
    remaining_days: number;
}

export const leavesApi = {
    getEntitlement: async () => {
        const res = await fetch("/api/leaves/me/entitlement", {
             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<LeaveEntitlement>;
    },
    
    getRequests: async () => {
         const res = await fetch("/api/leaves/me/requests", {
             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<LeaveRequest[]>;
    },

    createRequest: async (data: { start_date: string; end_date: string; note: string }) => {
        const res = await fetch("/api/leaves/request", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    },

    // Admin / Approvals
    getApprovals: async () => {
        const res = await fetch("/api/leaves/approvals", {
             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<LeaveRequest[]>;
    },

    approve: async (id: string) => {
         const res = await fetch(`/api/leaves/${id}/approve`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    },

    reject: async (id: string) => {
         const res = await fetch(`/api/leaves/${id}/reject`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    },

    // Admin Entitlement
    getAdminEntitlement: async (userId: string) => {
         const res = await fetch(`/api/leaves/admin/${userId}/entitlement`, {
             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<LeaveEntitlement>;
    },

    updateAdminEntitlement: async (userId: string, data: Partial<LeaveEntitlement>) => {
         const res = await fetch(`/api/leaves/admin/${userId}/entitlement`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    },

    getCalendar: async () => {
        const res = await fetch("/api/leaves/calendar", {
             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<LeaveRequest[]>;
    }
};
