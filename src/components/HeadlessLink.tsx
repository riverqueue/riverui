import { DataInteractive as HeadlessDataInteractive } from "@headlessui/react";
import { Link } from "@tanstack/react-router";
import { LinkProps } from "@tanstack/react-router";
import React from "react";

export const HeadlessLink = React.forwardRef(function HeadlessLink(
  props: {
    className: string;
  } & { to?: LinkProps["to"] } & Omit<LinkProps, "to">,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <HeadlessDataInteractive>
      <Link {...props} ref={ref} to={props.to} />
    </HeadlessDataInteractive>
  );
});
