import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { WorkflowState } from "@services/types";
import { WorkflowListItem } from "@services/workflows";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";

import { Badge, BadgeColor } from "./Badge";
import TopNav from "./TopNav";
import WorkflowListEmptyState from "./WorkflowListEmptyState";

type StateTab = { name: string; state: undefined | WorkflowState };

type WorkflowListProps = {
  loading: boolean;
  showingAll: boolean;
  workflowItems: WorkflowListItem[];
};
const tabs: StateTab[] = [
  { name: "All", state: undefined },
  { name: "Active", state: WorkflowState.Active },
  { name: "Inactive", state: WorkflowState.Inactive },
];

const workflowStateAndBadgeColor = (
  workflow: WorkflowListItem,
): [string, BadgeColor] => {
  const anyActive =
    workflow.countAvailable > 0 ||
    workflow.countRunning > 0 ||
    workflow.countRetryable > 0 ||
    workflow.countPending > 0 ||
    workflow.countScheduled > 0;
  if (workflow.countFailedDeps > 0) {
    if (anyActive) {
      return ["Active", "orange"];
    }
    return ["Failed", "red"];
  }
  if (anyActive) {
    return ["Running", "yellow"];
  }
  return ["Completed", "green"];
};

const BadgeForWorkflow = ({ workflow }: { workflow: WorkflowListItem }) => {
  const [state, color] = workflowStateAndBadgeColor(workflow);
  return <Badge color={color}>{state}</Badge>;
};

const jobCount = (workflow: WorkflowListItem): number =>
  workflow.countPending +
  workflow.countPending +
  workflow.countScheduled +
  workflow.countAvailable +
  workflow.countRunning +
  workflow.countRetryable +
  workflow.countCompleted +
  workflow.countCancelled +
  workflow.countDiscarded;

const WorkflowFilters = ({ className }: { className?: string }) => {
  return (
    <nav
      aria-label="Tabs"
      className={clsx("grow justify-center space-x-2", className)}
    >
      {tabs.map((tab) => (
        <Link
          activeOptions={{ exact: true }}
          activeProps={{
            className:
              "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-300",
          }}
          className="rounded-md px-3 py-2 text-sm font-medium"
          inactiveProps={{
            className:
              "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          }}
          key={tab.name}
          search={tab.state ? { state: tab.state } : {}}
          to="/workflows"
        >
          {tab.name}
        </Link>
      ))}
    </nav>
  );
};

const WorkflowTable = ({
  workflowItems,
}: {
  workflowItems: WorkflowListItem[];
}) => {
  return (
    <table className="w-full max-w-full table-auto divide-y divide-slate-300 dark:divide-slate-700">
      <thead>
        <tr>
          <th
            className="hidden px-3 py-2.5 text-left font-mono text-sm font-semibold text-slate-900 lg:table-cell dark:text-slate-100"
            scope="col"
          >
            ID
          </th>
          <th
            className="py-2.5 pr-3 pl-4 text-left text-sm font-semibold text-slate-900 sm:pl-0 dark:text-slate-100"
            scope="col"
          >
            Name
          </th>
          <th
            className="table-cell px-3 py-2.5 text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
            scope="col"
          >
            Status
          </th>
          <th
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 md:table-cell dark:text-slate-100"
            scope="col"
          >
            Created
          </th>
          <th
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
            scope="col"
          >
            Pending Jobs
          </th>
          <th
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
            scope="col"
          >
            Total Jobs
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
        {workflowItems.map((workflowItem) => (
          <tr key={workflowItem.id}>
            <td className="max-w-72 py-2 pr-3 pl-4 text-sm font-medium text-slate-700 sm:w-auto sm:pl-0 dark:text-slate-300">
              <div className="truncate font-mono font-semibold dark:text-slate-100">
                <Link
                  params={{ workflowId: workflowItem.id }}
                  to="/workflows/$workflowId"
                >
                  {workflowItem.id}
                </Link>
              </div>
              <div className="mt-1 truncate text-slate-500 lg:hidden dark:text-slate-300">
                {workflowItem.name || "Unnamed workflow"}
              </div>
              <div className="mt-1 truncate md:hidden">
                <RelativeTimeFormatter
                  addSuffix
                  includeSeconds
                  time={workflowItem.createdAt}
                />
              </div>
            </td>
            <td className="py-2 pr-3 pl-4 text-sm font-medium text-slate-700 sm:w-auto sm:pl-0 lg:max-w-44 dark:text-slate-300">
              <div className="lg:hidden">
                <BadgeForWorkflow workflow={workflowItem} />
              </div>
              <dl className="font-normal md:hidden">
                <dt className="sr-only sm:hidden">Total Jobs</dt>
                <dd className="mt-1 truncate sm:hidden">
                  {jobCount(workflowItem)} jobs
                </dd>
                <dt className="sr-only sm:hidden">Pending</dt>
                <dd className="mt-1 truncate sm:hidden">
                  {workflowItem.countPending} pending
                </dd>
              </dl>
              <div
                className="hidden truncate lg:block"
                title={workflowItem.name || ""}
              >
                {workflowItem.name || "Unnamed workflow"}
              </div>
            </td>
            <td className="hidden px-3 py-2 text-sm text-slate-500 lg:table-cell dark:text-slate-300">
              <BadgeForWorkflow workflow={workflowItem} />
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 md:table-cell dark:text-slate-300">
              <RelativeTimeFormatter
                addSuffix
                includeSeconds
                time={workflowItem.createdAt}
              />
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
              {workflowItem.countPending}
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
              {jobCount(workflowItem)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const WorkflowList = ({
  loading,
  showingAll,
  workflowItems,
}: WorkflowListProps) => {
  return (
    <div className="size-full">
      <TopNav>
        <header className="flex flex-1 items-center">
          <h1 className="hidden text-base leading-6 font-semibold text-slate-900 sm:block dark:text-slate-100">
            Workflows
          </h1>

          <WorkflowFilters className="flex" />
        </header>
      </TopNav>

      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 mt-8 sm:-mx-0">
          {loading ? (
            <div>Loading...</div>
          ) : workflowItems.length > 0 ? (
            <WorkflowTable workflowItems={workflowItems} />
          ) : (
            <WorkflowListEmptyState showingAll={showingAll} />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowList;
