import {
  DeadLetterJobsRefreshSettingContext,
  RefreshSettingContext,
} from "@contexts/RefreshSettings";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useContext } from "react";

export const Route = createFileRoute("/dead-letter-jobs")({
  beforeLoad: ({ context: { features } }) => {
    if (!features.deadLetterJobs) throw notFound();
  },
  component: DeadLetterJobsLayout,
});

function DeadLetterJobsLayout() {
  const refreshSetting = useContext(DeadLetterJobsRefreshSettingContext);

  return (
    <RefreshSettingContext.Provider value={refreshSetting}>
      <Outlet />
    </RefreshSettingContext.Provider>
  );
}
