import { apiClient } from "./client";

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
    getEntitlement: () => apiClient.get<LeaveEntitlement>("/leaves/me/entitlement"),
    
    getRequests: () => apiClient.get<LeaveRequest[]>("/leaves/me/requests"),

    createRequest: (data: { start_date: string; end_date: string; note: string }) => 
        apiClient.post<any>("/leaves/request", data),

    getApprovals: () => apiClient.get<LeaveRequest[]>("/leaves/approvals"),

    approve: (id: string) => apiClient.post<any>(`/leaves/${id}/approve`),

    reject: (id: string) => apiClient.post<any>(`/leaves/${id}/reject`),

    getAdminEntitlement: (userId: string) => 
        apiClient.get<LeaveEntitlement>(`/leaves/admin/${userId}/entitlement`),

    updateAdminEntitlement: (userId: string, data: Partial<LeaveEntitlement>) => 
        apiClient.put<any>(`/leaves/admin/${userId}/entitlement`, data),

    getCalendar: () => apiClient.get<LeaveRequest[]>("/leaves/calendar"),
    
    getUserLeaves: (userId: string) => 
        apiClient.get<LeaveRequest[]>(`/leaves/admin/users/${userId}/leaves`),
        
    getUserEntitlement: (userId: string, year: number) => 
        apiClient.get<LeaveEntitlement>(`/leaves/admin/users/${userId}/entitlement?year=${year}`)
};
