/** Rendered width of each workflow node card (px). */
export const nodeWidth = 256;

/** Rendered height of each workflow node card (px). */
export const nodeHeight = 44;

/**
 * Extra padding around each node card where edge turns are forbidden (px).
 * Prevents bends from visually overlapping node borders.
 */
export const turnNodePadding = 12;

/**
 * Minimum horizontal distance of the final straight segment into the target
 * handle (px). Ensures the incoming edge is visually distinct from a vertical
 * drop-in.
 */
export const minTargetApproach = 20;

/** Horizontal distance between successive candidate bend lanes (px). */
export const bendNudgeStep = 8;

/**
 * Maximum nudge steps to probe in each direction from the baseline bend lane.
 * Total search range: +/-192px.
 */
export const bendNudgeMaxSteps = 24;

/**
 * Vertical tolerance for considering two nodes to be on the same row (px).
 * Dagre coordinates can land on sub-pixel values, so we allow a tiny delta.
 */
export const sameRowTolerance = 1;

/**
 * Horizontal distance from a target node's left edge where the shared merge
 * lane is placed (px).
 */
export const targetMergePadding = 20;
