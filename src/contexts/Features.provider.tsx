import { featuresKey, getFeatures } from "@services/features";
import { useQuery } from "@tanstack/react-query";

import { FeaturesContext } from "./Features";

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const { data: features, isLoading } = useQuery({
    queryFn: getFeatures,
    queryKey: featuresKey(),
    // Refetch every 30 minutes, these are unlikely to change much:
    refetchInterval: 30 * 60 * 1000,
  });

  // Block rendering until features are loaded:
  if (isLoading || !features) {
    return <div></div>;
  }

  return (
    <FeaturesContext.Provider value={{ features }}>
      {children}
    </FeaturesContext.Provider>
  );
}
