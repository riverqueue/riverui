export enum FilterTypeId {
  JOB_ID = "id",
  JOB_KIND = "kind",
  PRIORITY = "priority",
  QUEUE = "queue",
}

export interface Filter {
  id: string;
  prefix: string;
  typeId: FilterTypeId;
  values: string[];
}

export interface FilterType {
  id: FilterTypeId;
  label: string;
  prefix: string;
}

export const AVAILABLE_FILTERS: FilterType[] = [
  {
    id: FilterTypeId.JOB_KIND,
    label: "Job Kind",
    prefix: "kind:",
  },
  {
    id: FilterTypeId.QUEUE,
    label: "Queue",
    prefix: "queue:",
  },
  {
    id: FilterTypeId.PRIORITY,
    label: "Priority",
    prefix: "priority:",
  },
  {
    id: FilterTypeId.JOB_ID,
    label: "Job ID",
    prefix: "id:",
  },
];
