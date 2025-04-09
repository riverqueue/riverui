import { Root } from "@components/Root";
import { type Features, featuresKey, getFeatures } from "@services/features";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{
  features: Features;
  queryClient: QueryClient;
}>()({
  beforeLoad: async ({ context: { queryClient } }) => {
    const features = await queryClient.ensureQueryData({
      queryKey: featuresKey(),
      queryFn: getFeatures,
    });

    return {
      features,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  return <Root />;
}
