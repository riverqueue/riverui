import Layout from "@components/Layout";
import { Outlet } from "@tanstack/react-router";
import React, { PropsWithChildren, Suspense } from "react";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

type RootProps = PropsWithChildren<object>;

export const Root = (_: RootProps) => {
  return (
    <>
      <Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </Suspense>

      <Layout>
        <Outlet />
      </Layout>
    </>
  );
};
