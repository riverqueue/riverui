import { Queue } from "@services/queues";

import TopNavTitleOnly from "./TopNavTitleOnly";

const Content = ({ loading, queue }: QueueDetailProps) => {
  if (loading) {
    return <h4>Loading…</h4>;
  }

  if (!queue) {
    return <p>Queue not found.</p>;
  }

  return <p>Loaded queue {queue.name}</p>;
};

type QueueDetailProps = {
  loading: boolean;
  name: string;
  queue?: Queue;
};

const QueueDetail = (props: QueueDetailProps) => {
  const { name } = props;

  return (
    <div className="size-full">
      <TopNavTitleOnly
        title={
          <>
            Queue: <span className="font-mono">{name}</span>
          </>
        }
      />

      <div className="mx-auto p-4 sm:px-6 lg:px-8">
        <Content {...props} />
      </div>
    </div>
  );
};

export default QueueDetail;
