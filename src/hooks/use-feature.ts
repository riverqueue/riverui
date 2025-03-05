import { useMemo } from "react";

const isNil = (val: null | string | undefined): boolean =>
  val === undefined || val === null;

const getBoolVal = (val?: boolean | null | string): boolean => {
  if (typeof val === "string") {
    return val === "true";
  }

  return !!val;
};

const useFeature = (name: string, enabled = false): boolean => {
  const featureEnabled = useMemo((): boolean => {
    const localStorageValue = window?.localStorage?.getItem(`FEATURE_${name}`);
    const envVar: string | undefined = import.meta.env[`VITE_FEATURE_${name}`];

    if (!isNil(localStorageValue)) return getBoolVal(localStorageValue);
    if (!isNil(envVar)) return getBoolVal(envVar);

    return !!enabled;
  }, [name, enabled]);

  return featureEnabled;
};

export default useFeature;
