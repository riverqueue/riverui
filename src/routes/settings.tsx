import Layout from "@components/Layout";
import SettingsPage from "@components/SettingsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <Layout>
      <SettingsPage />
    </Layout>
  );
}
