import { createFileRoute, redirect } from "@tanstack/react-router";
import { JobState } from "@services/types";

export const Route = createFileRoute("/")({
  loader: () => {
    throw redirect({ to: "/jobs", search: { state: JobState.Running } });
  },
  component: () => <></>,
});
