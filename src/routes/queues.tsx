import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/queues")({
  component: () => {
    return <Outlet />;
  },
});
