import { Button } from "@components/Button";

type ListPaginationProps = {
  canShowFewer: boolean;
  canShowMore: boolean;
  showFewer: () => void;
  showMore: () => void;
};

const ListPagination = ({
  canShowFewer,
  canShowMore,
  showFewer,
  showMore,
}: ListPaginationProps) => (
  <nav
    aria-label="Pagination"
    className="sticky inset-x-0 bottom-0 flex items-center justify-center border-t border-black/5 bg-white py-3 dark:border-white/5 dark:bg-slate-900"
  >
    <Button
      className="mx-2"
      color="light"
      disabled={!canShowFewer}
      onClick={() => showFewer()}
    >
      Fewer
    </Button>
    <Button
      className="mx-2"
      color="light"
      disabled={!canShowMore}
      onClick={() => showMore()}
    >
      More
    </Button>
  </nav>
);

export default ListPagination;
