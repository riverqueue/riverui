import { Navigate, createFileRoute } from "@tanstack/react-router";
import { JobState } from "@services/types";

const Index = () => (
  <Navigate to="/jobs" search={{ state: JobState.Running }} />
);

export const Route = createFileRoute("/")({
  component: Index,
});
