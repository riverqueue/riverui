import { ReactNode } from "react";

import TopNav from "./TopNav";

type TopNavTitleOnlyProps = {
  title: ReactNode | string;
};

const TopNavTitleOnly = ({ title }: TopNavTitleOnlyProps) => {
  return (
    <TopNav>
      <div className="flex items-center">
        <h1 className="inline text-base leading-6 font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
      </div>
    </TopNav>
  );
};

export default TopNavTitleOnly;
