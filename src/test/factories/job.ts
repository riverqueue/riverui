import { faker } from "@faker-js/faker";
import { AttemptError, Job } from "@services/jobs";
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
    maxAttempts: 25,
    metadata: {},
    priority: 1,
    queue: "default",
    scheduledAt: createdAt,
    state: JobState.Available,
    tags: ["urgent"],
  };
});
