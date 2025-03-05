import { formatDurationShort } from "@utils/time";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [relative, setRelative] = useState("");
  const nowSec = useTime();
  const now = useMemo(() => new Date(nowSec * 1000), [nowSec]);
  const start = startTime || now;
  const end = endTime || now;
  const subsecondEnabled = subsecond === undefined ? !!endTime : subsecond;

  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const recompute = () => {
      return formatDurationShort(end, start, subsecondEnabled);
    };
    setRelative(recompute);

    if (!endTime) {
      timer.current = setInterval(() => {
        setRelative(recompute);
      }, 1000);
    }

    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [end, endTime, start, subsecondEnabled]);

  return relative;
};
