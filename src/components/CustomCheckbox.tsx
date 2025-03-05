import { classNames } from "@utils/style";
import React, { useCallback, useEffect, useRef } from "react";

export function CustomCheckbox({
  checked,
  className,
  indeterminate,
  onChange,
  ...props
}: {
  className?: string;
  indeterminate?: boolean;
  onChange?: (
    checked: boolean,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className" | "onChange" | "type"
>) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const controlledOnChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(!checked, event);
      }
    },
    [checked, onChange],
  );

  return (
    <input
      checked={checked}
      className={classNames(
        "h-4 w-4 rounded-sm border-slate-300 text-brand-primary focus:ring-indigo-600",
        // Background color applied to control in dark mode
        "dark:border-slate-700 dark:bg-white/5",
        className || "",
      )}
      onChange={controlledOnChange}
      ref={checkboxRef}
      type="checkbox"
      {...props}
    />
  );
}
