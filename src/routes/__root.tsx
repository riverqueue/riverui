import { Button } from "@components/Button";
import NotFoundPage from "@components/NotFoundPage";
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
  // Also shown for a pane this server doesn't support, such as a Pro-only
  // route opened on an OSS server.
  notFoundComponent: () => (
    <NotFoundPage
      action={
        <Button plain to="/jobs">
          Return to job list <span aria-hidden="true">&rarr;</span>
        </Button>
      }
      description="This page doesn't exist, or this River UI server doesn't support it."
      heading="Page not found"
      title="Not Found"
    />
  ),
});

function RootComponent() {
  return <Root />;
}
