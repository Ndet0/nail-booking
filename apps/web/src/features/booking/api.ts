import type { AppointmentLocation, AvailabilityDto } from "@nailsbychao/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useAvailability(serviceId: string, date: string, location: AppointmentLocation) {
  return useQuery({
    queryKey: ["availability", serviceId, date, location],
    queryFn: () =>
      apiFetch<AvailabilityDto>(
        `/availability?${new URLSearchParams({ serviceId, date, location })}`,
      ),
    enabled: serviceId.length > 0,
    // Slots change as people book; keep them fresh.
    staleTime: 30_000,
    // Keeps the day strip's length while the next day loads.
    placeholderData: keepPreviousData,
  });
}
