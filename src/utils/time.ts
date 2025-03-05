import {
  differenceInMilliseconds,
  differenceInSeconds,
  formatDistance,
} from "date-fns";

export interface FormatRelativeOptions {
  addSuffix?: boolean;
  humanize?: boolean;
  includeSeconds?: boolean;
  now?: Date;
}

export function formatDurationShort(
  dateA: Date,
  dateB: Date,
  subsecond?: boolean,
): string {
  const totalMs = differenceInMilliseconds(dateA, dateB);
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  // calculate the number of hundredths of a second remaining:
  const hundredths = Math.floor((totalMs - totalSeconds * 1000) / 10);

  const hasHours = hours !== 0;
  const hasMinutes = hasHours || minutes !== 0;

  const zeroPad = (num: number, isLeadingGroup: boolean = false): string =>
    isLeadingGroup ? String(num) : String(num).padStart(2, "0");

  return `${hasHours ? zeroPad(hours, hasHours) + "h" : ""}${
    hasMinutes ? zeroPad(minutes, !hasHours && hasMinutes) + "m" : ""
  }${
    zeroPad(seconds, !hasHours && !hasMinutes) +
    (hasMinutes || !subsecond
      ? ""
      : "." + String(hundredths).padStart(2, "0")) +
    "s"
  }`;
}

export function formatRelative(
  date: Date,
  {
    addSuffix,
    humanize = true,
    includeSeconds,
    now = new Date(),
  }: FormatRelativeOptions = {},
) {
  const diff = differenceInSeconds(now, date);

  if (humanize) {
    if (diff < 30) {
      return "now";
    }
    return formatDistance(date, now, { addSuffix, includeSeconds });
  }

  if (diff < 60 && includeSeconds) {
    return `${diff}s`;
  }
  return formatDistance(date, now, { addSuffix, includeSeconds });
}

export function getFormatUpdateInterval(date: Date, now: Date = new Date()) {
  const diff = differenceInSeconds(now, date);

  if (diff < 60) {
    return 1000;
  } else if (diff < 3600) {
    return 60000;
  } else if (diff >= 3600 && diff <= 86400) {
    return 3600000;
  } else {
    return 0;
  }
}
