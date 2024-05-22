import { PauseIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import clsx from "clsx";

import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { ArrowPathIcon } from "@heroicons/react/20/solid";

type RefreshIntervalSetting = {
  name: string;
  value: number;
};

const refreshIntervals: RefreshIntervalSetting[] = [
  { name: "Pause", value: 0 },
  { name: "1s", value: 1000 },
  { name: "2s", value: 2000 },
  { name: "5s", value: 5000 },
  { name: "10s", value: 10000 },
  { name: "30s", value: 30000 },
  { name: "60s", value: 60000 },
];

export function RefreshPauser(
  props: React.ComponentPropsWithoutRef<
    typeof Listbox<"div", RefreshIntervalSetting>
  >
) {
  const { intervalMs, setIntervalMs } = useRefreshSetting();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-6" />;
  }

  const disabled = intervalMs === 0;
  const selectedInterval =
    refreshIntervals.find((i) => i.value === intervalMs) ??
    ({ name: "Custom", value: intervalMs } as RefreshIntervalSetting);

  return (
    <Listbox
      as="div"
      value={selectedInterval}
      by="value"
      onChange={(newInterval) => setIntervalMs(newInterval.value)}
      {...props}
    >
      <Label className="sr-only">
        {" "}
        {disabled ? "Resume live updates" : "Pause live updates"}{" "}
      </Label>
      <ListboxButton
        className="relative z-10 flex size-7 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label="Theme"
      >
        <span className="sr-only">
          {disabled ? "Resume live updates" : "Pause live updates"}
        </span>
        {disabled ? (
          <PauseIcon className="size-6 text-slate-400" aria-hidden="true" />
        ) : (
          <ArrowPathIcon
            className="size-6 text-slate-400 motion-safe:animate-spin-50-50"
            aria-hidden="true"
          />
        )}
      </ListboxButton>
      <ListboxOptions className="absolute right-0 top-full mt-3 w-32 space-y-1 rounded-xl bg-white p-3 text-sm font-medium shadow-md shadow-black/5 ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/5">
        <div className="px-2 text-xs font-semibold leading-6 text-slate-500">
          Live Updates
        </div>
        {refreshIntervals.map((intervalSetting) => (
          <ListboxOption
            key={intervalSetting.value}
            value={intervalSetting}
            className={({ focus, selected }) =>
              clsx(
                "flex cursor-pointer select-none rounded-[0.625rem] px-2 py-1",
                {
                  "text-blue-600 dark:text-blue-400": selected,
                  "text-slate-900 dark:text-white": focus && !selected,
                  "text-slate-700 dark:text-slate-300": !focus && !selected,
                  "bg-slate-100 dark:bg-slate-700": focus,
                }
              )
            }
          >
            {({ selected }) => (
              <div
                className={clsx({
                  "text-blue-600 dark:text-blue-400": selected,
                  "text-slate-600 dark:text-slate-300": !selected,
                })}
              >
                {intervalSetting.name}
              </div>
            )}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
