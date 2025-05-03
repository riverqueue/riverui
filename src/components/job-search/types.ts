export enum JobFilterTypeID {
  ID = "id",
  KIND = "kind",
  PRIORITY = "priority",
  QUEUE = "queue",
}

export interface JobFilter {
  id: string;
  prefix: string;
  typeId: JobFilterTypeID;
  values: string[];
}

export interface FilterType {
  id: JobFilterTypeID;
  label: string;
  prefix: string;
}

export const AVAILABLE_FILTERS: FilterType[] = [
  {
    id: JobFilterTypeID.ID,
    label: "ID",
    prefix: "id:",
  },
  {
    id: JobFilterTypeID.KIND,
    label: "Kind",
    prefix: "kind:",
  },
  {
    id: JobFilterTypeID.QUEUE,
    label: "Queue",
    prefix: "queue:",
  },
  {
    id: JobFilterTypeID.PRIORITY,
    label: "Priority",
    prefix: "priority:",
  },
];
