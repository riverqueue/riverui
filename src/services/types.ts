export enum JobState {
  Available = "available",
  Cancelled = "cancelled",
  Completed = "completed",
  Discarded = "discarded",
  Pending = "pending",
  Retryable = "retryable",
  Running = "running",
  Scheduled = "scheduled",
}

export enum WorkflowState {
  Active = "active",
  Inactive = "inactive",
}

export type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>;

export type CamelToSnakeCase<S extends string> =
  S extends `${infer T}${infer U}`
    ? `${T extends Capitalize<T>
        ? "_"
        : ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
    : S;

export type Heroicon = React.ForwardRefExoticComponent<
  {
    title?: string;
    titleId?: string;
  } & React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> &
    React.RefAttributes<SVGSVGElement>
>;

export type KeysToCamelCase<T> = {
  [K in keyof T as CamelCase<K & string>]: T[K];
};

export type KeysToSnakeCase<T> = {
  [K in keyof T as CamelToSnakeCase<K & string>]: T[K];
};

export type SnakeToCamelCase<S extends string> =
  S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

export type StringEndingWithUnderscoreAt = `${string}_at`;
