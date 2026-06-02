export type RefreshQueryOptions = {
  refetchInterval: false | number;
  refetchOnReconnect: boolean;
  refetchOnWindowFocus: boolean;
};

export const refreshQueryOptions = (
  intervalMs: number,
): RefreshQueryOptions => {
  const enabled = intervalMs > 0;

  return {
    refetchInterval: enabled ? intervalMs : false,
    refetchOnReconnect: enabled,
    refetchOnWindowFocus: enabled,
  };
};
