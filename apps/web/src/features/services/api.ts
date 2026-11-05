import type { HealthDto, ServiceDto } from "@nailsbychao/types";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => apiFetch<ServiceDto[]>("/services"),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: ["services", id],
    queryFn: () => apiFetch<ServiceDto>(`/services/${encodeURIComponent(id)}`),
    enabled: id.length > 0,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthDto>("/health"),
    retry: false,
    refetchInterval: 30_000,
  });
}
