import { faker } from "@faker-js/faker";
import { type ConcurrencyConfig, type Queue } from "@services/queues";
import { sub } from "date-fns";
import { Factory } from "fishery";

class QueueFactory extends Factory<Queue, object> {
  active() {
    return this.params({
      pausedAt: undefined,
    });
  }

  paused() {
    return this.params({
      pausedAt: sub(new Date(), { minutes: 30 }),
    });
  }

  withConcurrency(configOverrides?: Partial<ConcurrencyConfig>) {
    // Create a valid ConcurrencyConfig with safe defaults
    const concurrency: ConcurrencyConfig = {
      global_limit: configOverrides?.global_limit ?? 10,
      local_limit: configOverrides?.local_limit ?? 5,
      partition: {
        by_args: configOverrides?.partition?.by_args ?? [
          "customer_id",
          "region",
        ],
        by_kind: configOverrides?.partition?.by_kind ?? null,
      },
    };

    return this.params({
      concurrency,
    });
  }

  withoutConcurrency() {
    return this.params({
      concurrency: null,
    });
  }
}

export const queueFactory = QueueFactory.define(({ params, sequence }) => {
  const createdAt = params.createdAt || faker.date.recent({ days: 0.001 });
  const updatedAt = params.updatedAt || faker.date.recent({ days: 0.0001 });

  // Create a properly typed concurrency config
  let concurrency: ConcurrencyConfig | null = null;
  if (params.concurrency) {
    concurrency = {
      global_limit: params.concurrency.global_limit || 0,
      local_limit: params.concurrency.local_limit || 0,
      partition: {
        by_args: params.concurrency.partition?.by_args || null,
        by_kind: params.concurrency.partition?.by_kind || null,
      },
    };
  }

  return {
    concurrency,
    countAvailable:
      params.countAvailable || faker.number.int({ max: 500, min: 0 }),
    countRunning: params.countRunning || faker.number.int({ max: 100, min: 0 }),
    createdAt,
    name: params.name || `queue-${sequence}`,
    pausedAt: params.pausedAt,
    updatedAt,
  };
});
