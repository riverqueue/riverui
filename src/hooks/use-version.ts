import { getVersion, versionKey } from "@services/version";
import { useQuery } from "@tanstack/react-query";

export function useVersion() {
  // Refetch after deployments while keeping repeat visits inexpensive.
  return useQuery({
    queryFn: getVersion,
    queryKey: versionKey(),
    staleTime: 5 * 60 * 1000,
  });
}
