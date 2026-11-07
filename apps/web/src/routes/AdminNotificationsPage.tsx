import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotificationList } from "@/components/NotificationList";
import {
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  useAdminNotifications,
} from "@/features/admin/api";

export function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const query = useAdminNotifications();
  const markOne = useMutation({
    mutationFn: markAdminNotificationRead,
    onSuccess: (data) => queryClient.setQueryData(["admin-notifications"], data),
  });
  const markAll = useMutation({
    mutationFn: markAllAdminNotificationsRead,
    onSuccess: (data) => queryClient.setQueryData(["admin-notifications"], data),
  });

  return (
    <NotificationList
      page
      label="New bookings, cancellations, and moves."
      query={query}
      markOne={markOne}
      markAll={markAll}
      bookingPath={(id) => `/admin/bookings/${encodeURIComponent(id)}`}
    />
  );
}
