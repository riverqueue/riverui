import { Factory } from "fishery";
import { faker } from "@faker-js/faker";

import { AttemptError, Job } from "@services/jobs";
import { JobState } from "@services/types";
import { add, sub } from "date-fns";

class AttemptErrorFactory extends Factory<AttemptError, object> {}

export const attemptErrorFactory = AttemptErrorFactory.define(({ params }) => {
  const attempt = params.attempt || 1;
  return {
    at: params.at || sub(new Date(), { seconds: (21 - attempt) * 7.3 }),
    attempt,
    error: "Failed yet again with some Go message",
    trace: "...",
  };
});

class JobFactory extends Factory<Job, object> {
  available() {
    return this.params({});
  }

  cancelled() {
    const finalizedAt = faker.date.recent({ days: 0.001 });
    const createdAt = sub(finalizedAt, { hours: 1, seconds: 37 });
    const scheduledAt = sub(finalizedAt, { seconds: 37 });

    return this.params({
      attempt: 1,
      attemptedAt: sub(finalizedAt, { seconds: 10 }),
      attemptedBy: ["the-hardest-worker-1"],
      createdAt,
      finalizedAt,
      scheduledAt,
      state: JobState.Cancelled,
    });
  }

  completed() {
    const finalizedAt = faker.date.recent({ days: 0.001 });
    const createdAt = sub(finalizedAt, { hours: 1, seconds: 37 });
    const scheduledAt = sub(finalizedAt, { seconds: 37 });

    return this.params({
      attempt: 1,
      attemptedAt: sub(finalizedAt, { seconds: 10 }),
      attemptedBy: ["the-hardest-worker-1"],
      createdAt,
      finalizedAt,
      scheduledAt,
      state: JobState.Completed,
      tags: ["completed", "it's_already_done"],
    });
  }

  discarded() {
    const finalizedAt = faker.date.recent({ days: 0.001 });
    const createdAt = sub(finalizedAt, { hours: 1, seconds: 37 });
    const scheduledAt = sub(finalizedAt, { seconds: 37 });

    return this.params({
      attempt: 1,
      attemptedAt: sub(finalizedAt, { seconds: 10 }),
      attemptedBy: ["the-hardest-worker-1"],
      errors: [
        attemptErrorFactory.build({
          at: add(finalizedAt, {
            seconds: faker.number.float({ min: 0.01, max: 2.5 }),
          }),
          attempt: 1,
        }),
      ],
      createdAt,
      finalizedAt,
      scheduledAt,
      state: JobState.Discarded,
    });
  }

  pending() {
    const createdAt = faker.date.recent({ days: 0.001 });
    const scheduledAt = sub(createdAt, { seconds: 10 });
    return this.params({
      createdAt,
      scheduledAt,
      state: JobState.Pending,
    });
  }

  retryable() {
    const attemptedAt = faker.date.recent({ days: 0.01 });
    const erroredAt = add(attemptedAt, {
      seconds: faker.number.float({ min: 0.01, max: 95 }),
    });
    return this.params({
      attempt: 9,
      attemptedAt,
      attemptedBy: [
        "worker-1",
        "worker-2",
        "worker-3",
        "worker-1",
        "worker-2",
        "worker-3",
        "worker-1",
        "worker-2",
        "worker-3",
      ],
      errors: [
        attemptErrorFactory.build({ attempt: 1 }),
        attemptErrorFactory.build({ attempt: 2 }),
        attemptErrorFactory.build({ attempt: 3 }),
        attemptErrorFactory.build({ attempt: 4 }),
        attemptErrorFactory.build({ attempt: 5 }),
        attemptErrorFactory.build({ attempt: 6 }),
        attemptErrorFactory.build({ attempt: 7 }),
        attemptErrorFactory.build({ attempt: 8 }),
        attemptErrorFactory.build({ attempt: 9 }),
        attemptErrorFactory.build({
          at: erroredAt,
          attempt: 10,
        }),
      ],
      createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
      scheduledAt: add(erroredAt, { minutes: 15, seconds: 22.5 }),
      state: JobState.Retryable,
    });
  }

  running() {
    const attemptedAt = faker.date.recent({ days: 0.01 });
    return this.params({
      attempt: 1,
      attemptedAt,
      attemptedBy: ["worker-1"],
      createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
      scheduledAt: sub(attemptedAt, { seconds: 22.5 }),
      state: JobState.Running,
    });
  }

  scheduled() {
    const createdAt = faker.date.recent({ days: 0.001 });
    const scheduledAt = add(createdAt, { minutes: 30 });

    return this.params({
      createdAt,
      scheduledAt,
      state: JobState.Scheduled,
      tags: ["scheduled", "soon_in_future"],
    });
  }

  scheduledSnoozed() {
    const createdAt = faker.date.recent({ days: 0.001 });
    const scheduledAt = add(createdAt, { minutes: 30 });

    return this.params({
      attemptedAt: add(createdAt, { seconds: 3 }),
      attemptedBy: ["worker-1"],
      attempt: 1,
      errors: [],
      createdAt,
      scheduledAt,
      state: JobState.Scheduled,
      tags: ["scheduled", "soon_in_future"],
    });
  }
}

export const jobFactory = JobFactory.define(({ sequence }) => {
  const createdAt = faker.date.recent({ days: 0.001 });

  return {
    args: { foo: "bar", baz: 1 },
    attempt: 0,
    attemptedAt: undefined,
    attemptedBy: [],
    createdAt: createdAt,
    errors: [],
    finalizedAt: undefined,
    id: BigInt(sequence),
    kind: "SimpleTestJob",
    maxAttempts: 25,
    metadata: {},
    priority: 1,
    queue: "default",
    scheduledAt: createdAt,
    state: JobState.Available,
    tags: ["urgent"],
  };
});
