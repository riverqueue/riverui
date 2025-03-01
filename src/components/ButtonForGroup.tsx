import { type ButtonProps as HeadlessButtonProps } from "@headlessui/react";
import { HeadlessLink } from "@components/HeadlessLink";

import { Heroicon } from "@services/types";
import { Button, ButtonProps } from "@components/Button";
import { classNames } from "@utils/style";

export default function ButtonForGroup({
  className,
  children,
  Icon: Icon,
  text,
  ...props
}: {
  children?: React.ReactNode;
  Icon?: Heroicon;
  text?: string;
} & Omit<ButtonProps, "children" | "color" | "outline" | "plain"> &
  (
    | Omit<HeadlessButtonProps, "className">
    | Omit<React.ComponentPropsWithoutRef<typeof HeadlessLink>, "className">
  )) {
  return (
    <Button
      outline
      className={classNames(
        "rounded-none first:rounded-l-md last:rounded-r-md",
        className || "",
      )}
      {...props}
      color={undefined}
    >
      {Icon && <Icon className="mr-2 size-5" aria-hidden="true" />}

      {children || text}
    </Button>
  );
}
