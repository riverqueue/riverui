import { getJob, getJobKey, listJobs, listJobsKey } from "@services/jobs";
import { JobState } from "@services/types";
import { afterEach, describe, expect, it, vi } from "vitest";

type APIAttemptErrorForTest = {
  at: string;
  attempt: number;
  error: string;
  trace: string;
};

type APIJobForTest = {
  args: string;
  attempt: number;
  attempted_by: string[];
  created_at: string;
  errors: APIAttemptErrorForTest[];
  finalized_at: undefined;
  id: number;
  kind: string;
  max_attempts: number;
  metadata: object;
  priority: number;
  queue: string;
  scheduled_at: string;
  state: JobState;
  tags: string[];
};

const apiJob = (overrides: Partial<APIJobForTest> = {}): APIJobForTest => ({
  args: '{"id":1970670598291982290}',
  attempt: 0,
  attempted_by: [],
  created_at: "2026-04-21T17:57:00Z",
  errors: [],
  finalized_at: undefined,
  id: 123,
  kind: "RowOperation",
  max_attempts: 25,
  metadata: {},
  priority: 1,
  queue: "default",
  scheduled_at: "2026-04-21T17:57:00Z",
  state: JobState.Available,
  tags: [],
  ...overrides,
});

describe("jobs service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("preserves list job args as raw JSON text", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [apiJob()] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    const jobs = await listJobs({
      client: undefined as never,
      meta: undefined,
      queryKey: listJobsKey({ limit: 10 }),
      signal: new AbortController().signal,
    });

    expect(jobs[0]?.argsRaw).toBe('{"id":1970670598291982290}');
  });

  it("preserves job detail args as raw JSON text", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(apiJob()), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    const job = await getJob({
      client: undefined as never,
      meta: undefined,
      queryKey: getJobKey(123n),
      signal: new AbortController().signal,
    });

    expect(job.argsRaw).toBe('{"id":1970670598291982290}');
  });
});
