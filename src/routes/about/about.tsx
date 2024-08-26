import { createFileRoute } from "@tanstack/react-router";

const About = () => <div>Hello from About!</div>;

export const Route = createFileRoute("/about/about")({
  component: About,
});
