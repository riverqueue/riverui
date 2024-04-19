import { Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import Layout from "@components/Layout";
import { PropsWithChildren } from "react";

// import { Loader, useLoader } from "@tanstack/react-loaders";
// import { getSession } from "@services/auth";
// import { SignOutButton } from "./SignOutButton/SignOutButton";

type RootProps = PropsWithChildren<object>;

export const Root = (_: RootProps) => {
  // const [session] = useLoader({ key: sessionLoader.key });

  return (
    <>
      <TanStackRouterDevtools position="bottom-right" />

      <Layout>
        <Outlet />
      </Layout>
      {/* <div className="card">
        <button onClick={() => setJobState(JobState.Completed)}>
          Show Completed Jobs
        </button>
      </div>
      <JobList jobState={jobState} /> */}
      {/* // {session.status === "success" ? <SignOutButton /> : null} */}
    </>
  );
};

// export const sessionLoader = new Loader({
//   key: "session",
//   loader: () => {
//     return getSession();
//   },
// });
