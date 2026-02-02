import * as Headless from "@headlessui/react";
import clsx from "clsx";
import React from "react";

import { badgeColors } from "./Badge.colors";
import { TouchTarget } from "./Button";
import { HeadlessLink } from "./HeadlessLink";
export type BadgeColor = keyof typeof badgeColors;

type BadgeProps = { color?: BadgeColor };

export function Badge({
  className,
  color = "zinc",
  ...props
}: BadgeProps & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={clsx(
        "inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline",
        className,
        badgeColors[color],
      )}
    />
  );
}

export const BadgeButton = React.forwardRef(function BadgeButton(
  {
    children,
    className,
    color = "zinc",
    ...props
  }: { children: React.ReactNode; className?: string } & (
    | Omit<Headless.ButtonProps, "className">
    | Omit<React.ComponentPropsWithoutRef<typeof HeadlessLink>, "className">
  ) &
    BadgeProps,
  ref: React.ForwardedRef<HTMLElement>,
) {
  const classes = clsx(
    className,
    "group relative inline-flex rounded-md focus:outline-hidden data-focus:outline data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500",
  );

  return "href" in props ? (
    <HeadlessLink
      {...props}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLAnchorElement>}
    >
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </HeadlessLink>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </Headless.Button>
  );
});
