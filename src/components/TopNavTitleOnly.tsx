import { ReactNode } from "react";
import TopNav from "./TopNav";

type TopNavTitleOnlyProps = {
  title: string | ReactNode;
};

const TopNavTitleOnly = ({ title }: TopNavTitleOnlyProps) => {
  return (
    <TopNav>
      <div className="flex items-center">
        <h1 className="inline text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">
          {title}
        </h1>
      </div>
    </TopNav>
  );
};

export default TopNavTitleOnly;
