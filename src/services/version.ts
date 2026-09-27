import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";

export type Version = {
  goVersion: string;
  modified: boolean;
  revision: string;
  time: string;
  version: string;
};

export type VersionFromAPI = {
  go_version: string;
  modified: boolean;
  revision: string;
  time: string;
  version: string;
};

export const versionKey = () => ["version"] as const;
export type VersionKey = ReturnType<typeof versionKey>;

export const apiVersionToVersion = (version: VersionFromAPI): Version => ({
  goVersion: version.go_version,
  modified: version.modified,
  revision: version.revision,
  time: version.time,
  version: version.version,
});

export const getVersion: QueryFunction<Version, VersionKey> = async ({
  signal,
}) => {
  return API.get<VersionFromAPI>({ path: "/version" }, { signal }).then(
    apiVersionToVersion,
  );
};
