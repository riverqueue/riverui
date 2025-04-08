import { faker } from "@faker-js/faker";
import { type Producer } from "@services/producers";
import { type ConcurrencyConfig } from "@services/queues";
import { sub } from "date-fns";
import { Factory } from "fishery";

class ProducerFactory extends Factory<Producer, object> {
  active() {
    return this.params({
      pausedAt: undefined,
    });
  }

  paused() {
    return this.params({
      pausedAt: sub(new Date(), { minutes: 10 }),
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
}

export const producerFactory = ProducerFactory.define(({ sequence }) => {
  const createdAt = faker.date.recent({ days: 1 });
  const updatedAt = faker.date.recent({ days: 0.5 });

  return {
    clientId: `client-${sequence}`,
    concurrency: null,
    createdAt,
    id: sequence,
    maxWorkers: faker.number.int({ max: 50, min: 5 }),
    pausedAt: undefined,
    queueName: `queue-${faker.number.int({ max: 5, min: 1 })}`,
    running: faker.number.int({ max: 20, min: 0 }),
    updatedAt,
  };
});
