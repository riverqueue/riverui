import { useFeatures } from "@contexts/Features.hook";
import { useStore } from "@nanostores/react";
import {
  $userSettings,
  clearShowJobArgs,
  setShowJobArgs,
} from "@stores/settings";

export function useSettings() {
  const { features } = useFeatures();
  const settings = useStore($userSettings);

  const shouldShowJobArgs =
    settings.showJobArgs !== undefined
      ? settings.showJobArgs
      : !features.jobListHideArgsByDefault;

  return {
    clearShowJobArgs,
    setShowJobArgs,
    settings,
    shouldShowJobArgs,
  };
}
