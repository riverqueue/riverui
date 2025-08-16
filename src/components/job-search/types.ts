export enum JobFilterTypeID {
  ID = "id",
  KIND = "kind",
  PRIORITY = "priority",
  QUEUE = "queue",
}

export interface FilterType {
  id: JobFilterTypeID;
  label: string;
  match: string;
}

export interface JobFilter {
  id: string;
  match: string;
  typeId: JobFilterTypeID;
  values: string[];
}

export const AVAILABLE_FILTERS: FilterType[] = [
  {
    id: JobFilterTypeID.ID,
    label: "id",
    match: "id:",
  },
  {
    id: JobFilterTypeID.KIND,
    label: "kind",
    match: "kind:",
  },
  {
    id: JobFilterTypeID.PRIORITY,
    label: "priority",
    match: "priority:",
  },
  {
    id: JobFilterTypeID.QUEUE,
    label: "queue",
    match: "queue:",
  },
];
