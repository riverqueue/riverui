import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";

import {
  fetchDeadLetterSuggestions,
  getDeadLetterJob,
  getDeadLetterJobKey,
  listDeadLetterJobs,
  listDeadLetterJobsKey,
  retryDeadLetterJob,
} from "./deadLetterJobs";

const job = {
  args: '{"id":1970670598291982290}',
  attempt: 3,
  attempted_by: [],
  created_at: "2026-10-21T00:00:00Z",
  errors: [],
  finalized_at: "2026-10-21T10:00:00Z",
  id: "1970670598291982290",
  kind: "send_email",
  max_attempts: 3,
  metadata: {},
  priority: 1,
  queue: "mail",
  scheduled_at: "2026-10-21T00:00:00Z",
  state: "discarded",
  tags: [],
};

afterEach(() => vi.unstubAllGlobals());

test("requests a bounded list without losing ID precision", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: [job] }));
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient();
  const jobs = await client.fetchQuery({
    queryFn: listDeadLetterJobs,
    queryKey: listDeadLetterJobsKey(40),
  });
  expect(jobs[0].id).toBe(1970670598291982290n);
  expect(jobs[0].finalizedAt).toEqual(new Date(job.finalized_at));
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/pro/dead-letter-jobs?limit=40"),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("gets a dead letter job and retries it using the Pro endpoints", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(job))
    .mockResolvedValueOnce(
      Response.json({
        ...job,
        attempt: 0,
        id: "1970670598291982291",
        state: "available",
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient();
  const original = await client.fetchQuery({
    queryFn: getDeadLetterJob,
    queryKey: getDeadLetterJobKey(BigInt(job.id)),
  });
  expect(original.createdAt).toEqual(new Date(job.created_at));
  expect(original.errors).toEqual([]);
  expect(original.argsRaw).toBe(job.args);
  const retried = await client
    .getMutationCache()
    .build(client, { mutationFn: retryDeadLetterJob })
    .execute(original.id);
  expect(retried.id).toBe(1970670598291982291n);
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringContaining(`/pro/dead-letter-jobs/${job.id}/retry`),
    expect.objectContaining({ method: "POST" }),
  );
});

test("sends repeated filter parameters and separates filtered caches", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ data: [] }));
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient();
  const filters = {
    ids: [job.id, "9223372036854775807"],
    kinds: ["send_email", "report"],
    priorities: ["1", "3"],
    queues: ["mail"],
    tags: ["urgent", "customer&partner"],
  };
  await client.fetchQuery({
    queryFn: listDeadLetterJobs,
    queryKey: listDeadLetterJobsKey(40, filters),
  });
  const request = fetch.mock.calls[0][0];
  expect(typeof request).toBe("string");
  const url = new URL(String(request), "http://localhost");
  expect(url.searchParams.get("limit")).toBe("40");
  for (const [key, values] of Object.entries(filters))
    expect(url.searchParams.getAll(key)).toEqual(values);
  expect(client.getQueryData(listDeadLetterJobsKey(40))).toBeUndefined();
  expect(client.getQueryData(listDeadLetterJobsKey(40, filters))).toEqual([]);
});

test("fetches archive autocomplete with selected values excluded", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ data: ["archive_report"] }));
  vi.stubGlobal("fetch", fetch);
  expect(
    await fetchDeadLetterSuggestions("job_kind", "archive_", [
      "archive_email",
      "old&job",
    ]),
  ).toEqual(["archive_report"]);
  const url = new URL(String(fetch.mock.calls[0][0]), "http://localhost");
  expect(url.pathname).toBe("/api/pro/dead-letter-jobs/autocomplete");
  expect(url.searchParams.get("facet")).toBe("job_kind");
  expect(url.searchParams.get("match")).toBe("archive_");
  expect(url.searchParams.getAll("exclude")).toEqual([
    "archive_email",
    "old&job",
  ]);
});
