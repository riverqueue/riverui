import { getVersion, versionKey } from "@services/version";
import { useQuery } from "@tanstack/react-query";

export function useVersion() {
  // Build info is immutable for the lifetime of the server process.
  return useQuery({
    queryFn: getVersion,
    queryKey: versionKey(),
    staleTime: Infinity,
  });
}
