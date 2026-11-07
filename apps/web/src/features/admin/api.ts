import type {
  AdminBookingDto,
  AdminCalendarDto,
  AdminGalleryImageDto,
  AdminProfileDto,
  AdminServiceDto,
  AdminStaffDto,
  BookingStatus,
  NotificationListDto,
  Page,
  TimeOffDto,
  WorkingHoursDto,
} from "@nailsbychao/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";

export function useAdminSession() {
  return useQuery({
    queryKey: ["admin-session"],
    retry: false,
    queryFn: async () => {
      try {
        return await apiFetch<AdminProfileDto>("/admin/me", { auth: true });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("Those details were not accepted.");
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
}

export function useAdminBookings(filters: { from: string; to: string; status: string }) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return useQuery({
    queryKey: ["admin-bookings", filters],
    queryFn: () =>
      apiFetch<Page<AdminBookingDto>>(`/admin/bookings${query ? `?${query}` : ""}`, { auth: true }),
  });
}

export function useAdminBooking(id: string) {
  return useQuery({
    queryKey: ["admin-booking", id],
    enabled: id.length > 0,
    queryFn: () =>
      apiFetch<AdminBookingDto>(`/admin/bookings/${encodeURIComponent(id)}`, { auth: true }),
  });
}

export function useUpdateBookingStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: BookingStatus) =>
      apiFetch<AdminBookingDto>(`/admin/bookings/${encodeURIComponent(id)}`, {
        auth: true,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (booking) => {
      queryClient.setQueryData(["admin-booking", id], booking);
      void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });
}

export function useAdminServices() {
  return useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiFetch<Page<AdminServiceDto>>("/admin/services?limit=100", { auth: true }),
  });
}

export function useAdminStaff() {
  return useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => apiFetch<Page<AdminStaffDto>>("/admin/staff?limit=100", { auth: true }),
  });
}

export function useStaffHours(staffId: string) {
  return useQuery({
    queryKey: ["admin-hours", staffId],
    enabled: staffId.length > 0,
    queryFn: () =>
      apiFetch<WorkingHoursDto[]>(`/admin/staff/${encodeURIComponent(staffId)}/hours`, {
        auth: true,
      }),
  });
}

export function useAdminCalendar(staffId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["admin-calendar", staffId, from, to],
    enabled: staffId.length > 0 && from <= to,
    queryFn: () =>
      apiFetch<AdminCalendarDto>(`/admin/calendar?${new URLSearchParams({ staffId, from, to })}`, {
        auth: true,
      }),
  });
}

export function useTimeOff(staffId: string) {
  return useQuery({
    queryKey: ["admin-time-off", staffId],
    enabled: staffId.length > 0,
    queryFn: () =>
      apiFetch<Page<TimeOffDto>>(
        `/admin/time-off?staffId=${encodeURIComponent(staffId)}&limit=100`,
        { auth: true },
      ),
  });
}

export function useAdminNotifications(enabled = true) {
  return useQuery({
    queryKey: ["admin-notifications"],
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => apiFetch<NotificationListDto>("/admin/notifications", { auth: true }),
  });
}

export function markAllAdminNotificationsRead() {
  return apiFetch<NotificationListDto>("/admin/notifications/read", { auth: true, method: "POST" });
}

export function markAdminNotificationRead(id: string) {
  return apiFetch<NotificationListDto>(`/admin/notifications/${encodeURIComponent(id)}/read`, {
    auth: true,
    method: "POST",
  });
}

export function useAdminGallery() {
  return useQuery({
    queryKey: ["admin-gallery"],
    queryFn: () => apiFetch<Page<AdminGalleryImageDto>>("/admin/gallery?limit=100", { auth: true }),
  });
}
