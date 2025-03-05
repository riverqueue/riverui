import type React from "react";

import { Button } from "@components/Button";
import { HeadlessLink } from "@components/HeadlessLink";
import {
  Description as HeadlessDescription,
  type DescriptionProps as HeadlessDescriptionProps,
  Label as HeadlessLabel,
  type LabelProps as HeadlessLabelProps,
  Menu as HeadlessMenu,
  MenuButton as HeadlessMenuButton,
  MenuHeading as HeadlessMenuHeading,
  type MenuHeadingProps as HeadlessMenuHeadingProps,
  MenuItem as HeadlessMenuItem,
  type MenuItemProps as HeadlessMenuItemProps,
  MenuItems as HeadlessMenuItems,
  type MenuItemsProps as HeadlessMenuItemsProps,
  type MenuProps as HeadlessMenuProps,
  MenuSection as HeadlessMenuSection,
  type MenuSectionProps as HeadlessMenuSectionProps,
  MenuSeparator as HeadlessMenuSeparator,
  type MenuSeparatorProps as HeadlessMenuSeparatorProps,
  Transition as HeadlessTransition,
} from "@headlessui/react";
import { LinkProps } from "@tanstack/react-router";
import clsx from "clsx";

export function Dropdown(props: HeadlessMenuProps) {
  return <HeadlessMenu {...props} />;
}

export function DropdownButton<T extends React.ElementType = typeof Button>(
  props: React.ComponentProps<typeof HeadlessMenuButton<T>>,
) {
  return <HeadlessMenuButton as={Button} {...props} />;
}

export function DropdownDescription({
  className,
  ...props
}: HeadlessDescriptionProps) {
  return (
    <HeadlessDescription
      data-slot="description"
      {...props}
      className={clsx(
        className,
        "col-span-2 col-start-2 row-start-2 text-sm/5 text-zinc-500 group-data-focus:text-white sm:text-xs/5 dark:text-zinc-400 forced-colors:group-data-focus:text-[HighlightText]",
      )}
    />
  );
}

export function DropdownHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(className, "col-span-5 px-3.5 pt-2.5 pb-1 sm:px-3")}
    />
  );
}

export function DropdownHeading({
  className,
  ...props
}: HeadlessMenuHeadingProps) {
  return (
    <HeadlessMenuHeading
      {...props}
      className={clsx(
        className,
        "col-span-full grid grid-cols-[1fr_auto] gap-x-12 px-3.5 pt-2 pb-1 text-sm/5 font-medium text-zinc-500 sm:px-3 sm:text-xs/5 dark:text-zinc-400",
      )}
    />
  );
}

export function DropdownItem(
  props: { to?: LinkProps["to"] } & HeadlessMenuItemProps<"button"> &
    Omit<Omit<LinkProps, "to">, "type">,
) {
  return (
    <HeadlessMenuItem
      as={props.to ? HeadlessLink : "button"}
      type={props.to ? undefined : "button"}
      {...props}
      className={clsx(
        props.className,

        // Base styles
        "group cursor-default rounded-lg px-3.5 py-2.5 focus:outline-hidden sm:px-3 sm:py-1.5",

        // Text styles
        "text-left text-sm/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]",

        // Focus
        "data-focus:bg-blue-500 data-focus:text-white",

        // Disabled state
        "data-disabled:opacity-50",

        // Forced colors mode
        "forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText] forced-colors:data-focus:*:data-[slot=icon]:text-[HighlightText]",

        // Use subgrid when available but fallback to an explicit grid layout if not
        "col-span-full grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] items-center supports-[grid-template-columns:subgrid]:grid-cols-subgrid",

        // Icon
        "*:data-[slot=icon]:col-start-1 *:data-[slot=icon]:row-start-1 *:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4",
        "*:data-[slot=icon]:text-zinc-500 data-focus:*:data-[slot=icon]:text-white dark:*:data-[slot=icon]:text-zinc-500 dark:data-focus:*:data-[slot=icon]:text-white",
      )}
    />
  );
}

export function DropdownLabel({ className, ...props }: HeadlessLabelProps) {
  return (
    <HeadlessLabel
      {...props}
      className={clsx(className, "col-start-2 row-start-1")}
      data-slot="label"
      {...props}
    />
  );
}

export function DropdownMenu({
  anchor = "bottom",
  ...props
}: HeadlessMenuItemsProps) {
  return (
    <HeadlessTransition leave="duration-100 ease-in" leaveTo="opacity-0">
      <HeadlessMenuItems
        {...props}
        anchor={anchor}
        className={clsx(
          props.className,

          // Anchor positioning
          "[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(3)] data-[anchor~=end]:[--anchor-offset:4px] data-[anchor~=start]:[--anchor-offset:-4px]",

          // Base styles
          "isolate w-max rounded-xl p-1",

          // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
          "outline outline-1 outline-transparent focus:outline-hidden",

          // Handle scrolling when menu won't fit in viewport
          "overflow-y-auto",

          // Popover background
          "bg-white backdrop-blur-xl dark:bg-slate-800",

          // Shadows
          "shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset",

          // Define grid at the menu level if subgrid is supported
          "supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]",
        )}
      />
    </HeadlessTransition>
  );
}

export function DropdownSection({
  className,
  ...props
}: HeadlessMenuSectionProps) {
  return (
    <HeadlessMenuSection
      {...props}
      className={clsx(
        className,
        // Define grid at the section level instead of the item level if subgrid is supported
        "col-span-full supports-[grid-template-columns:subgrid]:grid supports-[grid-template-columns:subgrid]:grid-cols-[auto_1fr_1.5rem_0.5rem_auto]",
      )}
    />
  );
}

export function DropdownSeparator({
  className,
  ...props
}: HeadlessMenuSeparatorProps) {
  return (
    <HeadlessMenuSeparator
      {...props}
      className={clsx(
        className,
        "col-span-full mx-3.5 my-1 h-px border-0 bg-zinc-950/5 sm:mx-3 dark:bg-white/10 forced-colors:bg-[CanvasText]",
      )}
    />
  );
}

export function DropdownShortcut({
  className,
  keys,
  ...props
}: { keys: string | string[] } & HeadlessDescriptionProps<"kbd">) {
  return (
    <HeadlessDescription
      as="kbd"
      {...props}
      className={clsx(
        className,
        "col-start-5 row-start-1 flex justify-self-end",
      )}
    >
      {(Array.isArray(keys) ? keys : keys.split("")).map((char, index) => (
        <kbd
          className={clsx([
            "min-w-[2ch] text-center font-sans text-zinc-400 capitalize group-data-focus:text-white forced-colors:group-data-focus:text-[HighlightText]",

            // Make sure key names that are longer than one character (like "Tab") have extra space
            index > 0 && char.length > 1 && "pl-1",
          ])}
          key={index}
        >
          {char}
        </kbd>
      ))}
    </HeadlessDescription>
  );
}
