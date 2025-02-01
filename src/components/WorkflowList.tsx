import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { WorkflowListItem } from "@services/workflows";
import { Link } from "@tanstack/react-router";
import { WorkflowState } from "@services/types";
import { Badge, BadgeColor } from "./Badge";
import TopNav from "./TopNav";
import clsx from "clsx";
import WorkflowListEmptyState from "./WorkflowListEmptyState";

type WorkflowListProps = {
  loading: boolean;
  showingAll: boolean;
  workflowItems: WorkflowListItem[];
};

type StateTab = { name: string; state: WorkflowState | undefined };
const tabs: StateTab[] = [
  { name: "All", state: undefined },
  { name: "Active", state: WorkflowState.Active },
  { name: "Inactive", state: WorkflowState.Inactive },
];

const workflowStateAndBadgeColor = (
  workflow: WorkflowListItem
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
          key={tab.name}
          to="/workflows"
          search={tab.state ? { state: tab.state } : {}}
          className="rounded-md px-3 py-2 text-sm font-medium"
          activeOptions={{ exact: true }}
          activeProps={{
            className:
              "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-300",
          }}
          inactiveProps={{
            className:
              "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          }}
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
            scope="col"
            className="hidden px-3 py-2.5 text-left font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 lg:table-cell"
          >
            ID
          </th>
          <th
            scope="col"
            className="py-2.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 sm:pl-0"
          >
            Name
          </th>
          <th
            scope="col"
            className="table-cell px-3 py-2.5 text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Status
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 md:table-cell"
          >
            Created
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 sm:table-cell"
          >
            Pending Jobs
          </th>
          <th
            scope="col"
            className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100 sm:table-cell"
          >
            Total Jobs
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
        {workflowItems.map((workflowItem) => (
          <tr key={workflowItem.id}>
            <td className="max-w-72 py-2 pl-4 pr-3 text-sm font-medium text-slate-700 dark:text-slate-300 sm:w-auto sm:pl-0">
              <div className="truncate font-mono font-semibold dark:text-slate-100">
                <Link
                  to="/workflows/$workflowId"
                  params={{ workflowId: workflowItem.id }}
                >
                  {workflowItem.id}
                </Link>
              </div>
              <div className="mt-1 truncate text-slate-500 dark:text-slate-300 lg:hidden">
                {workflowItem.name || "Unnamed workflow"}
              </div>
              <div className="mt-1 truncate md:hidden">
                <RelativeTimeFormatter
                  time={workflowItem.createdAt}
                  addSuffix
                  includeSeconds
                />
              </div>
            </td>
            <td className="py-2 pl-4 pr-3 text-sm font-medium text-slate-700 dark:text-slate-300 sm:w-auto sm:pl-0 lg:max-w-44">
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
            <td className="hidden px-3 py-2 text-sm text-slate-500 dark:text-slate-300 lg:table-cell">
              <BadgeForWorkflow workflow={workflowItem} />
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 dark:text-slate-300 md:table-cell">
              <RelativeTimeFormatter
                time={workflowItem.createdAt}
                addSuffix
                includeSeconds
              />
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 dark:text-slate-300 sm:table-cell">
              {workflowItem.countPending}
            </td>
            <td className="hidden px-3 py-2 text-right text-sm text-slate-500 dark:text-slate-300 sm:table-cell">
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
          <h1 className="hidden text-base font-semibold leading-6 text-slate-900 dark:text-slate-100 sm:block">
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
