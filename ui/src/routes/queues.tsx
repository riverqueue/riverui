import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/queues")({
  component: () => {
    return <Outlet />;
  },
});
