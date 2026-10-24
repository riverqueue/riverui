import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dead-letter-jobs")({
  beforeLoad: ({ context: { features } }) => {
    if (!features.deadLetterJobs) throw notFound();
  },
  component: Outlet,
});
