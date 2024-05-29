import { Workflow } from "@services/workflows";
import WorkflowDiagram from "@components/WorkflowDiagram";

type WorkflowDetailProps = {
  workflow: Workflow;
};

export default function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const { tasks } = workflow;
  return (
    <>
      <header>
        {/* Heading */}
        <div className="mb-8 flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-300/10 p-4 dark:bg-gray-700/10 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-x-3">
              <div className="flex-none rounded-full bg-green-400/10 p-1 text-green-400">
                <div className="size-2 rounded-full bg-current" />
              </div>
              <h1 className="flex gap-x-3 text-2xl leading-7">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Workflow Detail
                </span>
              </h1>
            </div>
            <p className="ml-7 mt-2 text-base leading-6 text-slate-600 dark:text-slate-400">
              ID:{" "}
              <span className="font-mono">{tasks[0].metadata.workflow_id}</span>
              {/* {capitalize(job.state)} */}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto h-[32rem] w-full px-4 sm:px-6 lg:px-8">
        <WorkflowDiagram tasks={tasks} />
      </div>
    </>
  );
}
