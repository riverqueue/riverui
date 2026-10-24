import { ReactNode } from "react";

type EmptySetIconProps = React.ComponentProps<"svg">;

const EmptySetIcon = (props: EmptySetIconProps) => (
  <svg
    fill="currentColor"
    height="200"
    stroke="currentColor"
    viewBox="0 0 200 200"
    width="200"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="100" cy="100" fill="none" r="60" strokeWidth="10" />
    <line strokeWidth="10" x1="40" x2="160" y1="40" y2="160" />
  </svg>
);

type ListEmptyStateProps = {
  description: ReactNode;
  title: string;
};

const ListEmptyState = ({ description, title }: ListEmptyStateProps) => (
  <div className="flex h-full flex-col items-center justify-center px-4 py-16 text-center">
    <EmptySetIcon className="mx-auto size-12 text-gray-400" />
    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
      {title}
    </h3>
    <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
      {description}
    </p>
  </div>
);

export default ListEmptyState;
