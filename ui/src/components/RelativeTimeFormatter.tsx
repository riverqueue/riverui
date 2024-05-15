import { formatRelative } from "@utils/time";
import { useMemo } from "react";
import { useTime } from "react-time-sync";

type RelativeTimeFormatterProps = {
  addSuffix?: boolean;
  includeSeconds?: boolean;
  humanize?: boolean;
  time: Date;
};

const RelativeTimeFormatter = ({
  addSuffix,
  includeSeconds,
  humanize = false,
  time,
}: RelativeTimeFormatterProps): string => {
  const nowSec = useTime();
  const relative = useMemo(() => {
    const now = new Date(nowSec * 1000);
    return formatRelative(time, { addSuffix, includeSeconds, humanize, now });
  }, [addSuffix, includeSeconds, humanize, nowSec, time]);

  return relative;
};

export default RelativeTimeFormatter;
