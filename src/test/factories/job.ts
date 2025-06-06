import { faker } from "@faker-js/faker";
import { AttemptError, Job, JobMinimal } from "@services/jobs";
import { JobState } from "@services/types";
import { add, sub } from "date-fns";
import { Factory } from "fishery";

class AttemptErrorFactory extends Factory<AttemptError, object> {}

const sampleTrace = `
worker.go:184: panic: runtime error: invalid memory address or nil pointer dereference
    panic({0x1035d3c40?, 0x103c0f530?})
        /opt/homebrew/Cellar/go/1.24.0/libexec/src/runtime/panic.go:787 +0xf0
    github.com/riverqueue/myapp/worker.(*SyntheticBaseWorker).syntheticSleepOrError(0x0, {0x1036c44c0, 0x14000056380}, {0x1036bb5e0, 0x140000b0320})
        /Users/username/River/myapp/worker/synthetic_base_job.go:22 +0x50
    github.com/riverqueue/myapp/worker.(*ChargeCreditCard).Work(0x1400000c090, {0x1036c44c0, 0x14000056380}, 0x1400004a310)
        /Users/username/River/myapp/worker/charge_credit_card.go:33 +0x19c
    github.com/riverqueue/river/rivertest.(*wrapperWorkUnit[...]).Work(0x1036c4320, {0x1036c44c0, 0x140000562a0})
        /Users/username/River/river/rivertest/worker.go:281 +0x60
`.trim();

export const attemptErrorFactory = AttemptErrorFactory.define(({ params }) => {
  const attempt = params.attempt || 1;
  return {
    at: params.at || sub(new Date(), { seconds: (21 - attempt) * 7.3 }),
    attempt,
    error: "Failed yet again with some Go message",
    trace: sampleTrace,
  };
});

// Helper type to extract only JobMinimal fields from Job:
type JobMinimalFields = Pick<Job, keyof JobMinimal>;

class JobMinimalFactory extends Factory<JobMinimal, object> {
  available() {
    return this.params(jobFactory.available().build());
  }

  cancelled() {
    return this.params(jobFactory.cancelled().build());
  }

  completed() {
    return this.params(jobFactory.completed().build());
  }

  discarded() {
    return this.params(jobFactory.discarded().build());
  }

  pending() {
    return this.params(jobFactory.pending().build());
  }

  retryable() {
    return this.params(jobFactory.retryable().build());
  }

  running() {
    return this.params(jobFactory.running().build());
  }

  scheduled() {
    return this.params(jobFactory.scheduled().build());
  }

  scheduledSnoozed() {
    return this.params(jobFactory.scheduledSnoozed().build());
  }
}

export const jobMinimalFactory = JobMinimalFactory.define(({ sequence }) => {
  const job = jobFactory.build({ id: BigInt(sequence) });
  return job as JobMinimalFields;
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
      createdAt,
      errors: [
        attemptErrorFactory.build({
          at: add(finalizedAt, {
            seconds: faker.number.float({ max: 2.5, min: 0.01 }),
          }),
          attempt: 1,
        }),
      ],
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
      seconds: faker.number.float({ max: 95, min: 0.01 }),
    });
    const multilineError = `
      This is a long error message that spans multiple lines.
      It is used to test the ability of the JobAttemptErrors component to display long error messages.
       
      It should not show as a single paragraph with no linebreaks.
    `.trim();

    const riverLogs = {
      1: "Starting job execution...",
      2: "Retrying after first failure",
      3: "Connection timeout occurred\nAttempting to reconnect...",
      5: "Database connection established\nContinuing execution",
      7: "Processing data batch 1/5\nProcessing data batch 2/5\nProcessing data batch 3/5\nError: Invalid data format",
      8: "Attempting with modified parameters",
      9: "Final retry attempt with fallback strategy",
    };

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
      createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
      errors: [
        attemptErrorFactory.build({ attempt: 1 }),
        attemptErrorFactory.build({ attempt: 2 }),
        attemptErrorFactory.build({ attempt: 3, error: multilineError }),
        attemptErrorFactory.build({ attempt: 4 }),
        attemptErrorFactory.build({ attempt: 5 }),
        attemptErrorFactory.build({ attempt: 6 }),
        attemptErrorFactory.build({ attempt: 7 }),
        attemptErrorFactory.build({ attempt: 8, error: multilineError }),
        attemptErrorFactory.build({ attempt: 9, trace: undefined }),
        attemptErrorFactory.build({
          at: erroredAt,
          attempt: 10,
        }),
      ],
      logs: riverLogs,
      metadata: {
        "river:log": Object.entries(riverLogs).map(([attempt, log]) => ({
          attempt: parseInt(attempt),
          log,
        })),
      },
      scheduledAt: add(erroredAt, { minutes: 15, seconds: 22.5 }),
      state: JobState.Retryable,
    });
  }

  running() {
    const attemptedAt = faker.date.recent({ days: 0.01 });
    const riverLogs = {
      1: "Job started execution\nInitializing resources...\nConnected to external service\nProcessing request",
    };

    return this.params({
      attempt: 1,
      attemptedAt,
      attemptedBy: ["worker-1"],
      createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
      logs: riverLogs,
      metadata: {
        "river:log": Object.entries(riverLogs).map(([attempt, log]) => ({
          attempt: parseInt(attempt),
          log,
        })),
      },
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
      attempt: 1,
      attemptedAt: add(createdAt, { seconds: 3 }),
      attemptedBy: ["worker-1"],
      createdAt,
      errors: [],
      scheduledAt,
      state: JobState.Scheduled,
      tags: ["scheduled", "soon_in_future"],
    });
  }
}

export const jobFactory = JobFactory.define(({ sequence }) => {
  const createdAt = faker.date.recent({ days: 0.001 });

  return {
    args: { baz: 1, foo: "bar" },
    attempt: 0,
    attemptedAt: undefined,
    attemptedBy: [],
    createdAt: createdAt,
    errors: [],
    finalizedAt: undefined,
    id: BigInt(sequence),
    kind: "SimpleTestJob",
    logs: {},
    maxAttempts: 25,
    metadata: {},
    priority: 1,
    queue: "default",
    scheduledAt: createdAt,
    state: JobState.Available,
    tags: ["urgent"],
  };
});

JobFactory.prototype.completed = function () {
  const finalizedAt = faker.date.recent({ days: 0.001 });
  const createdAt = sub(finalizedAt, { hours: 1, seconds: 37 });
  const scheduledAt = sub(finalizedAt, { seconds: 37 });
  const riverLogs = {
    1: "Job started\nProcessing complete\nResult: success",
  };

  return this.params({
    attempt: 1,
    attemptedAt: sub(finalizedAt, { seconds: 10 }),
    attemptedBy: ["the-hardest-worker-1"],
    createdAt,
    finalizedAt,
    logs: riverLogs,
    metadata: {
      "river:log": Object.entries(riverLogs).map(([attempt, log]) => ({
        attempt: parseInt(attempt),
        log,
      })),
    },
    scheduledAt,
    state: JobState.Completed,
    tags: ["completed", "it's_already_done"],
  });
};

JobFactory.prototype.retryable = function () {
  const attemptedAt = faker.date.recent({ days: 0.01 });
  const erroredAt = add(attemptedAt, {
    seconds: faker.number.float({ max: 95, min: 0.01 }),
  });
  const multilineError = `
    This is a long error message that spans multiple lines.
    It is used to test the ability of the JobAttemptErrors component to display long error messages.
     
    It should not show as a single paragraph with no linebreaks.
  `.trim();

  const riverLogs = {
    1: "Starting job execution...",
    2: "Retrying after first failure",
    3: "Connection timeout occurred\nAttempting to reconnect...",
    5: "Database connection established\nContinuing execution",
    7: "Processing data batch 3/5\nError: Invalid data format",
    8: "Attempting with modified parameters",
    9: "Final retry attempt with fallback strategy",
  };

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
    createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
    errors: [
      attemptErrorFactory.build({ attempt: 1 }),
      attemptErrorFactory.build({ attempt: 2 }),
      attemptErrorFactory.build({ attempt: 3, error: multilineError }),
      attemptErrorFactory.build({ attempt: 4 }),
      attemptErrorFactory.build({ attempt: 5 }),
      attemptErrorFactory.build({ attempt: 6 }),
      attemptErrorFactory.build({ attempt: 7 }),
      attemptErrorFactory.build({ attempt: 8, error: multilineError }),
      attemptErrorFactory.build({ attempt: 9, trace: undefined }),
      attemptErrorFactory.build({
        at: erroredAt,
        attempt: 10,
      }),
    ],
    logs: riverLogs,
    metadata: {
      "river:log": Object.entries(riverLogs).map(([attempt, log]) => ({
        attempt: parseInt(attempt),
        log,
      })),
    },
    scheduledAt: add(erroredAt, { minutes: 15, seconds: 22.5 }),
    state: JobState.Retryable,
  });
};

JobFactory.prototype.running = function () {
  const attemptedAt = faker.date.recent({ days: 0.01 });
  const riverLogs = {
    1: "Job started execution\nInitializing resources...\nConnected to external service\nProcessing request",
  };

  return this.params({
    attempt: 1,
    attemptedAt,
    attemptedBy: ["worker-1"],
    createdAt: sub(attemptedAt, { minutes: 31, seconds: 30 }),
    logs: riverLogs,
    metadata: {
      "river:log": Object.entries(riverLogs).map(([attempt, log]) => ({
        attempt: parseInt(attempt),
        log,
      })),
    },
    scheduledAt: sub(attemptedAt, { seconds: 22.5 }),
    state: JobState.Running,
  });
};
