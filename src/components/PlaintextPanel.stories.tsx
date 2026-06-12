import type { Meta, StoryObj } from "@storybook/react-vite";

import PlaintextPanel from "./PlaintextPanel";

const meta: Meta<typeof PlaintextPanel> = {
  component: PlaintextPanel,
  parameters: {
    layout: "centered",
  },
  title: "Components/PlaintextPanel",
};

export default meta;
type Story = StoryObj<typeof PlaintextPanel>;

const multilineLog = [
  'time=2026-06-11T19:03:14Z level=info msg="starting job" job_id=123',
  'time=2026-06-11T19:03:15Z level=info msg="processing batch" batch=1 records=100',
  '{"attempt":1,"event":"finished","metadata":{"customerID":"cus_123","queue":"default"}}',
  "    indented continuation line",
  'time=2026-06-11T19:03:16Z level=error msg="this is a very long log line that should demonstrate horizontal scrolling on narrow screens" details=abcdefghijklmnopqrstuvwxyz0123456789',
].join("\n");

export const MultilineLog: Story = {
  args: {
    copyTitle: "Log Entry",
    text: multilineLog,
  },
  render: (args) => (
    <div className="w-[min(48rem,calc(100vw-2rem))]">
      <PlaintextPanel {...args} />
    </div>
  ),
};

export const WrappedExpression: Story = {
  args: {
    codeClassName: "whitespace-pre-wrap break-all",
    copyTitle: "Wait expression",
    text: [
      "all([",
      '  task.completed("prepare-customer-state"),',
      '  signal.received("manual-approval")',
      "])",
    ].join("\n"),
  },
  render: (args) => (
    <div className="w-[min(32rem,calc(100vw-2rem))]">
      <PlaintextPanel {...args} />
    </div>
  ),
};
