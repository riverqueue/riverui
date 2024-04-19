import { formatDurationShort } from "@utils/time";
import { useEffect, useRef, useState } from "react";

type DurationCompactProps = {
  endTime?: Date;
  startTime: Date;
};

export const DurationCompact = ({
  startTime,
  endTime,
}: DurationCompactProps) => {
  const [relative, setRelative] = useState("");

  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const recompute = () => {
      const end = endTime || new Date();
      return formatDurationShort(end, startTime, !!endTime);
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
  }, [endTime, startTime]);

  return relative;
};
