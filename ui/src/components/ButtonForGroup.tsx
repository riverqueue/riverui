import { Heroicon } from "@services/types";
import { FormEvent } from "react";
import { Button, ButtonProps } from "./Button";
import { classNames } from "@utils/style";

export default function ButtonForGroup({
  className,
  Icon,
  text,
  ...props
}: {
  Icon: Heroicon;
  onClick?: (event: FormEvent) => void;
  text: string;
} & Omit<ButtonProps, "children" | "color" | "outline" | "plain">) {
  return (
    <Button
      outline
      className={classNames(
        "rounded-none first:rounded-l-md last:rounded-r-md",
        className || ""
      )}
      {...props}
    >
      <Icon className="mr-2 size-5" aria-hidden="true" />
      {text}
    </Button>
  );
}
