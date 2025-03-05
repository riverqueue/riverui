import { formatRelative } from "@utils/time";
import { useMemo } from "react";
import { useTime } from "react-time-sync";

type RelativeTimeFormatterProps = {
  addSuffix?: boolean;
  humanize?: boolean;
  includeSeconds?: boolean;
  time: Date;
};

const RelativeTimeFormatter = ({
  addSuffix,
  humanize = false,
  includeSeconds,
  time,
}: RelativeTimeFormatterProps) => {
  const nowSec = useTime();
  const relative = useMemo(() => {
    const now = new Date(nowSec * 1000);
    return formatRelative(time, { addSuffix, humanize, includeSeconds, now });
  }, [addSuffix, includeSeconds, humanize, nowSec, time]);
  const utcTime = useMemo(() => time.toISOString(), [time]);

  return <span title={utcTime}>{relative}</span>;
};

export default RelativeTimeFormatter;
