import { persistentAtom } from "@nanostores/persistent";

export interface UserSettings {
  showJobArgs?: boolean;
}

const SETTINGS_KEY = "river_ui_user_settings";

export const $userSettings = persistentAtom<UserSettings>(
  SETTINGS_KEY,
  {},
  {
    decode: JSON.parse,
    encode: JSON.stringify,
  },
);

export const setShowJobArgs = (value: boolean | undefined) => {
  $userSettings.set({
    ...$userSettings.get(),
    showJobArgs: value,
  });
};

export const clearShowJobArgs = () => {
  const settings = $userSettings.get();
  const { showJobArgs: _showJobArgs, ...rest } = settings;
  $userSettings.set(rest);
};

export const clearAllSettings = () => {
  $userSettings.set({});
};
