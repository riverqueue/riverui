import { ReactNode } from "react";

import TopNavTitleOnly from "./TopNavTitleOnly";

type NotFoundPageProps = {
  action: ReactNode;
  description: ReactNode;
  heading: string;
  title: string;
};

export default function NotFoundPage({
  action,
  description,
  heading,
  title,
}: NotFoundPageProps) {
  return (
    <>
      <TopNavTitleOnly title={title} />

      <main className="grid min-h-full place-items-center px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-brand-primary dark:text-blue-500">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            {heading}
          </h1>
          <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
            {description}
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {action}
          </div>
        </div>
      </main>
    </>
  );
}
