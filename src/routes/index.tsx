import { JobState } from "@services/types";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    throw redirect({ to: "/jobs", search: { state: JobState.Running } });
  },
  component: () => <></>,
});
