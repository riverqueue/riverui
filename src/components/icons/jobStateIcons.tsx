import { forwardRef } from "react";

type IconProps = {
  title?: string;
  titleId?: string;
} & React.SVGProps<SVGSVGElement>;

// Circumference of r=9 circle: 2π·9 ≈ 56.549
// 75% arc (270°): 42.41, 25% gap: 14.14
const SPINNER_R = 9;
const SPINNER_DASH = "42.41 14.14";

/**
 * Animated ring spinner for the Running job state.
 *
 * Uses only CSS `transform: rotate()` for animation, which is composited
 * entirely on the GPU — no layout or paint cost per frame.
 */
export const RunningSpinnerIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ title, titleId, ...props }, ref) => (
    <svg
      aria-hidden="true"
      data-slot="icon"
      fill="none"
      ref={ref}
      viewBox="0 0 24 24"
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      <circle
        cx="12"
        cy="12"
        opacity="0.2"
        r={SPINNER_R}
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        className="origin-center animate-spin will-change-transform motion-reduce:animate-none"
        cx="12"
        cy="12"
        r={SPINNER_R}
        stroke="currentColor"
        strokeDasharray={SPINNER_DASH}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  ),
);
RunningSpinnerIcon.displayName = "RunningSpinnerIcon";

/**
 * Static ring indicator for non-active running steps (pending/completed).
 * Same shape as RunningSpinnerIcon but without animation.
 */
export const RunningIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ title, titleId, ...props }, ref) => (
    <svg
      aria-hidden="true"
      data-slot="icon"
      fill="none"
      ref={ref}
      viewBox="0 0 24 24"
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      <circle
        cx="12"
        cy="12"
        opacity="0.2"
        r={SPINNER_R}
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r={SPINNER_R}
        stroke="currentColor"
        strokeDasharray={SPINNER_DASH}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  ),
);
RunningIcon.displayName = "RunningIcon";
