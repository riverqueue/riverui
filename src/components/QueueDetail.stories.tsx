import { useFeatures } from "@contexts/Features.hook";
import { type Producer } from "@services/producers";
import { type ConcurrencyConfig } from "@services/queues";
import { Meta, StoryObj } from "@storybook/react-vite";
import { producerFactory } from "@test/factories/producer";
import { queueFactory } from "@test/factories/queue";
import { createFeatures } from "@test/utils/features";

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

// Active queue with no producers (features enabled)
export const ActiveQueueNoProducers: Story = {
  args: {
    producers: [],
    queue: queueFactory.active().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Paused queue with no producers
export const PausedQueueNoProducers: Story = {
  args: {
    producers: [],
    queue: queueFactory.paused().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Active queue with producers
export const ActiveQueueWithProducers: Story = {
  args: {
    producers: createProducers(5, "test-queue"),
    queue: queueFactory.active().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Paused queue with some paused producers
export const PausedQueueWithMixedProducers: Story = {
  args: {
    producers: createProducers(5, "test-queue", { paused: true }),
    queue: queueFactory.paused().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Queue with concurrency settings
export const WithConcurrencySettings: Story = {
  args: {
    producers: createProducers(3, "test-queue", { withConcurrency: true }),
    queue: queueFactory.withConcurrency().build(),
  },
  parameters: {
    features: createFeatures({
      hasProducerTable: true,
      producerQueries: true,
    }),
  },
};

// Queue with inconsistent producer concurrency settings
export const InconsistentConcurrency: Story = {
  args: {
    producers: createProducers(3, "test-queue", {
      inconsistentConcurrency: true,
      withConcurrency: true,
    }),
    queue: queueFactory.withConcurrency().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Queue with many producers
export const ManyProducers: Story = {
  args: {
    producers: createProducers(20, "test-queue", { paused: true }),
    queue: queueFactory.active().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Queue with single paused producer (should not show concurrency warning)
export const SinglePausedProducer: Story = {
  args: {
    producers: createProducers(1, "test-queue", { paused: true }),
    queue: queueFactory.active().build(),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            hasProducerTable: true,
            producerQueries: true,
          }),
        },
      },
    ],
  },
};

// Pro features disabled
export const WithoutPro: Story = {
  args: {
    producers: [],
    queue: queueFactory.active().build(),
  },
  parameters: {
    features: createFeatures({
      hasProducerTable: false,
    }),
  },
};
