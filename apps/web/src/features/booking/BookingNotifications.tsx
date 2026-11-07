import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationList } from "@/components/NotificationList";
import {
  listBookingNotifications,
  markBookingNotificationRead,
  markBookingNotificationsRead,
} from "@/features/booking/api";

export function BookingNotifications({ reference, token }: { reference: string; token: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["booking-notifications", reference] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => listBookingNotifications(reference, token),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const markOne = useMutation({
    mutationFn: (id: string) => markBookingNotificationRead(reference, token, id),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  const markAll = useMutation({
    mutationFn: () => markBookingNotificationsRead(reference, token),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return (
    <NotificationList
      label="Updates about this booking."
      query={query}
      markOne={markOne}
      markAll={markAll}
    />
  );
}
