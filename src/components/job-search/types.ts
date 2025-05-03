export enum JobFilterTypeID {
  ID = "id",
  KIND = "kind",
  PRIORITY = "priority",
  QUEUE = "queue",
}

export interface FilterType {
  id: JobFilterTypeID;
  label: string;
  prefix: string;
}

export interface JobFilter {
  id: string;
  prefix: string;
  typeId: JobFilterTypeID;
  values: string[];
}

export const AVAILABLE_FILTERS: FilterType[] = [
  {
    id: JobFilterTypeID.ID,
    label: "id",
    prefix: "id:",
  },
  {
    id: JobFilterTypeID.KIND,
    label: "kind",
    prefix: "kind:",
  },
  {
    id: JobFilterTypeID.QUEUE,
    label: "queue",
    prefix: "queue:",
  },
  {
    id: JobFilterTypeID.PRIORITY,
    label: "priority",
    prefix: "priority:",
  },
];
