import { formatDurationShort } from "@utils/time";
import { useMemo } from "react";
import { useTime } from "react-time-sync";

type DurationCompactProps = {
  endTime?: Date;
  startTime?: Date;
  subsecond?: boolean;
};

export const DurationCompact = ({
  endTime,
  startTime,
  subsecond,
}: DurationCompactProps) => {
  const nowSec = useTime();
  const subsecondEnabled = subsecond === undefined ? !!endTime : subsecond;

  const relative = useMemo(() => {
    // When `endTime` is undefined we use the current time; `useTime()` already
    // updates periodically, so we don't need to manage our own interval/state.
    const now = new Date(nowSec * 1000);
    const start = startTime ?? now;
    const end = endTime ?? now;
    return formatDurationShort(end, start, subsecondEnabled);
  }, [endTime, nowSec, startTime, subsecondEnabled]);

  return relative;
};
