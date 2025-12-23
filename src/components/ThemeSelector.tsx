import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import clsx from "clsx";
import { useTheme } from "next-themes";

const themes = [
  { icon: LightIcon, name: "Light", value: "light" },
  { icon: DarkIcon, name: "Dark", value: "dark" },
  { icon: SystemIcon, name: "System", value: "system" },
];

export function ThemeSelector(
  props: React.ComponentPropsWithoutRef<typeof Listbox<"div">>,
) {
  const { setTheme, theme } = useTheme();

  return (
    <Listbox as="div" onChange={setTheme} value={theme} {...props}>
      <Label className="sr-only">Theme</Label>
      <ListboxButton
        aria-label="Theme"
        className="relative z-10 flex size-7 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <LightIcon
          className={clsx(
            "size-4 dark:hidden",
            theme === "system" ? "fill-slate-400" : "fill-sky-400",
          )}
        />
        <DarkIcon
          className={clsx(
            "hidden size-4 dark:block",
            theme === "system" ? "fill-slate-400" : "fill-sky-400",
          )}
        />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom end"
        className="z-20 mt-3 w-36 space-y-1 rounded-xl bg-white p-3 text-sm font-medium shadow-md ring-1 shadow-black/5 ring-black/5 dark:bg-slate-800 dark:ring-white/5"
      >
        {themes.map((theme) => (
          <ListboxOption
            className={({ focus, selected }) =>
              clsx(
                "flex cursor-pointer items-center rounded-[0.625rem] p-1 select-none",
                {
                  "bg-slate-100 dark:bg-slate-700": focus,
                  "text-blue-600 dark:text-blue-400": selected,
                  "text-slate-700 dark:text-slate-300": !focus && !selected,
                  "text-slate-900 dark:text-white": focus && !selected,
                },
              )
            }
            key={theme.value}
            value={theme.value}
          >
            {({ selected }) => (
              <>
                <div className="rounded-md bg-white p-1 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-700 dark:ring-white/5 dark:ring-inset">
                  <theme.icon
                    className={clsx(
                      "size-4",
                      selected
                        ? "fill-blue-600 dark:fill-blue-400"
                        : "fill-slate-600 dark:fill-slate-400",
                    )}
                  />
                </div>
                <div className="ml-3">{theme.name}</div>
              </>
            )}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

function DarkIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path
        clipRule="evenodd"
        d="M7.23 3.333C7.757 2.905 7.68 2 7 2a6 6 0 1 0 0 12c.68 0 .758-.905.23-1.332A5.989 5.989 0 0 1 5 8c0-1.885.87-3.568 2.23-4.668ZM12 5a1 1 0 0 1 1 1 1 1 0 0 0 1 1 1 1 0 1 1 0 2 1 1 0 0 0-1 1 1 1 0 1 1-2 0 1 1 0 0 0-1-1 1 1 0 1 1 0-2 1 1 0 0 0 1-1 1 1 0 0 1 1-1Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function LightIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path
        clipRule="evenodd"
        d="M7 1a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0V1Zm4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm2.657-5.657a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm-1.415 11.313-.707-.707a1 1 0 0 1 1.415-1.415l.707.708a1 1 0 0 1-1.415 1.414ZM16 7.999a1 1 0 0 0-1-1h-1a1 1 0 1 0 0 2h1a1 1 0 0 0 1-1ZM7 14a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1Zm-2.536-2.464a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm0-8.486A1 1 0 0 1 3.05 4.464l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707ZM3 8a1 1 0 0 0-1-1H1a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function SystemIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path
        clipRule="evenodd"
        d="M1 4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-1.5l.31 1.242c.084.333.36.573.63.808.091.08.182.158.264.24A1 1 0 0 1 11 15H5a1 1 0 0 1-.704-1.71c.082-.082.173-.16.264-.24.27-.235.546-.475.63-.808L5.5 11H4a3 3 0 0 1-3-3V4Zm3-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
