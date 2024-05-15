import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { ArrowPathIcon, PauseIcon } from "@heroicons/react/24/outline";

export function RefreshPauser(_props: React.ComponentPropsWithoutRef<"div">) {
  const { disabled, setDisabled } = useRefreshSetting();

  return (
    <button
      type="button"
      className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
      onClick={() => setDisabled(!disabled)}
      title={disabled ? "Resume live updates" : "Pause live updates"}
    >
      <span className="sr-only">
        {disabled ? "Resume live updates" : "Pause live updates"}
      </span>
      {disabled ? (
        <ArrowPathIcon className="size-6" aria-hidden="true" />
      ) : (
        <PauseIcon className="size-6" aria-hidden="true" />
      )}
    </button>
  );
}
