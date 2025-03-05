import { Button, ButtonProps } from "@components/Button";
import { HeadlessLink } from "@components/HeadlessLink";
import { type ButtonProps as HeadlessButtonProps } from "@headlessui/react";
import { Heroicon } from "@services/types";
import { classNames } from "@utils/style";

export default function ButtonForGroup({
  children,
  className,
  Icon: Icon,
  text,
  ...props
}: {
  children?: React.ReactNode;
  Icon?: Heroicon;
  text?: string;
} & (
  | Omit<HeadlessButtonProps, "className">
  | Omit<React.ComponentPropsWithoutRef<typeof HeadlessLink>, "className">
) &
  Omit<ButtonProps, "children" | "color" | "outline" | "plain">) {
  return (
    <Button
      className={classNames(
        "rounded-none first:rounded-l-md last:rounded-r-md",
        className || "",
      )}
      outline
      {...props}
      color={undefined}
    >
      {Icon && <Icon aria-hidden="true" className="mr-2 size-5" />}

      {children || text}
    </Button>
  );
}
