import { DataInteractive as HeadlessDataInteractive } from "@headlessui/react";
import React from "react";
import { Link } from "@tanstack/react-router";
import { LinkProps } from "@tanstack/react-router";

export const HeadlessLink = React.forwardRef(function HeadlessLink(
  props: { to?: LinkProps["to"] } & Omit<LinkProps, "to"> & {
      className: string;
    },
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return (
    <HeadlessDataInteractive>
      <Link {...props} to={props.to} ref={ref} />
    </HeadlessDataInteractive>
  );
});
