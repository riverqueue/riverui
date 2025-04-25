import { type Producer } from "@services/producers";
import { type ConcurrencyConfig } from "@services/queues";
import { Meta, StoryObj } from "@storybook/react";
import { producerFactory } from "@test/factories/producer";
import { queueFactory } from "@test/factories/queue";

import QueueDetail from "./QueueDetail";

// Mock functions
const mockPauseQueue = (name: string) => {
  console.log(`Pausing queue: ${name}`);
};

const mockResumeQueue = (name: string) => {
  console.log(`Resuming queue: ${name}`);
};

const mockUpdateQueueConcurrency = (
  name: string,
  concurrency: ConcurrencyConfig | null,
) => {
  console.log(`Updating concurrency for queue ${name}:`, concurrency);
};

// Create consistent producers for stories
const createProducers = (
  count: number,
  queueName: string,
  options?: {
    inconsistentConcurrency?: boolean;
    paused?: boolean;
    withConcurrency?: boolean;
  },
): Producer[] => {
  return Array.from({ length: count }).map((_, i) => {
    let producer = producerFactory.params({ queueName }).build();

    if (options?.paused && i % 2 === 0) {
      producer = producerFactory.paused().params({ queueName }).build();
    }

    if (options?.withConcurrency) {
      producer = producerFactory
        .withConcurrency()
        .params({ queueName })
        .build();

      // For inconsistent concurrency, modify some producer settings
      if (options?.inconsistentConcurrency && i === 1) {
        producer.concurrency!.global_limit = 20;
      }
    }

    return producer;
  });
};

const meta: Meta<typeof QueueDetail> = {
  args: {
    loading: false,
    name: "test-queue",
    pauseQueue: mockPauseQueue,
    resumeQueue: mockResumeQueue,
    updateQueueConcurrency: mockUpdateQueueConcurrency,
  },
  component: QueueDetail,
  parameters: {
    layout: "fullscreen",
  },
  title: "Pages/QueueDetail",
};

export default meta;
type Story = StoryObj<typeof QueueDetail>;

// Loading state
export const Loading: Story = {
  args: {
    loading: true,
  },
};

// Queue not found
export const QueueNotFound: Story = {
  args: {
    loading: false,
    queue: undefined,
  },
};

// Active queue with no producers (features disabled)
export const ActiveQueueWithoutPro: Story = {
  args: {
    producers: [],
    queue: queueFactory.active().build(),
  },
  parameters: {
    features: {
      hasProducerTable: false,
    },
  },
};

// Active queue with no producers (features enabled)
export const ActiveQueueNoProducers: Story = {
  args: {
    producers: [],
    queue: queueFactory.active().build(),
  },
};

// Paused queue with no producers
export const PausedQueueNoProducers: Story = {
  args: {
    producers: [],
    queue: queueFactory.paused().build(),
  },
};

// Active queue with producers
export const ActiveQueueWithProducers: Story = {
  args: {
    producers: createProducers(5, "test-queue"),
    queue: queueFactory.active().build(),
  },
};

// Paused queue with some paused producers
export const PausedQueueWithMixedProducers: Story = {
  args: {
    producers: createProducers(5, "test-queue", { paused: true }),
    queue: queueFactory.paused().build(),
  },
};

// Queue with concurrency settings
export const QueueWithConcurrencySettings: Story = {
  args: {
    producers: createProducers(3, "test-queue", { withConcurrency: true }),
    queue: queueFactory.withConcurrency().build(),
  },
};

// Queue with inconsistent producer concurrency settings
export const QueueWithInconsistentConcurrency: Story = {
  args: {
    producers: createProducers(3, "test-queue", {
      inconsistentConcurrency: true,
      withConcurrency: true,
    }),
    queue: queueFactory.withConcurrency().build(),
  },
};

// Queue with many producers
export const QueueWithManyProducers: Story = {
  args: {
    producers: createProducers(20, "test-queue", { paused: true }),
    queue: queueFactory.active().build(),
  },
};
