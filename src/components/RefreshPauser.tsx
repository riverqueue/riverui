import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { PauseIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useEffect, useState } from "react";

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
  >,
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
      by="value"
      onChange={(newInterval) => setIntervalMs(newInterval.value)}
      value={selectedInterval}
      {...props}
    >
      <Label className="sr-only">
        {" "}
        {disabled ? "Resume live updates" : "Pause live updates"}{" "}
      </Label>
      <ListboxButton
        aria-label="Theme"
        className="relative z-10 flex size-7 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <span className="sr-only">
          {disabled ? "Resume live updates" : "Pause live updates"}
        </span>
        {disabled ? (
          <PauseIcon aria-hidden="true" className="size-6 text-slate-400" />
        ) : (
          // It's 2024 and this kind of div-wrapping hack is still necessary to get the
          // spinner to animate without insane CPU usage:
          <div className="size-6 overflow-hidden will-change-transform motion-safe:animate-spin-50-50">
            <ArrowPathIcon
              aria-hidden="true"
              className="size-6 text-slate-400"
            />
          </div>
        )}
      </ListboxButton>
      <ListboxOptions
        anchor="bottom end"
        className="z-20 mt-3 w-32 space-y-1 rounded-xl bg-white p-3 text-sm font-medium shadow-md ring-1 shadow-black/5 ring-black/5 dark:bg-slate-800 dark:ring-white/5"
      >
        <div className="px-2 text-xs leading-6 font-semibold text-slate-500">
          Live Updates
        </div>
        {refreshIntervals.map((intervalSetting) => (
          <ListboxOption
            className={({ focus, selected }) =>
              clsx(
                "flex cursor-pointer rounded-[0.625rem] px-2 py-1 select-none",
                {
                  "bg-slate-100 dark:bg-slate-700": focus,
                  "text-blue-600 dark:text-blue-400": selected,
                  "text-slate-700 dark:text-slate-300": !focus && !selected,
                  "text-slate-900 dark:text-white": focus && !selected,
                },
              )
            }
            key={intervalSetting.value}
            value={intervalSetting}
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
