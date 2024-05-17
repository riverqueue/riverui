/*
TODO: Update this component to use your client-side framework's link
component. We've provided examples of how to do this for Next.js,
Remix, and Inertia.js in the Catalyst documentation:

https://catalyst.tailwindui.com/docs#client-side-router-integration
*/

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
