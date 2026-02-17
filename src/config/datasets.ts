import type { ModuleId } from "@/types/brief";

export type DatasetId =
  | "ipu4-2q9a"
  | "rbx6-tga4"
  | "eabe-havv"
  | "6bgk-3dad"
  | "tqtj-sjs8"
  | "9jic-byiu"
  | "i6b5-j7bu"
  | "h9gi-nx95"
  | "erm2-nwe9"
  | "p7k6-2pm8"
  | "rv63-53db"
  | "tvpp-9vvx"
  | "5crt-au7u"
  | "tg4x-b46p";

export interface DatasetMeta {
  id: DatasetId;
  name: string;
  moduleHints: ModuleId[];
  url: string;
  ttlSeconds: number;
}

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  "ipu4-2q9a": {
    id: "ipu4-2q9a",
    name: "DOB Permit Issuance",
    moduleHints: ["dob_permits"],
    url: "https://data.cityofnewyork.us/Housing-Development/DOB-Permit-Issuance/ipu4-2q9a",
    ttlSeconds: 900,
  },
  "rbx6-tga4": {
    id: "rbx6-tga4",
    name: "DOB NOW: Build – Approved Permits",
    moduleHints: ["dob_permits"],
    url: "https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4",
    ttlSeconds: 900,
  },
  "eabe-havv": {
    id: "eabe-havv",
    name: "DOB Complaints Received",
    moduleHints: ["dob_permits"],
    url: "https://data.cityofnewyork.us/Housing-Development/DOB-Complaints-Received/eabe-havv",
    ttlSeconds: 900,
  },
  "6bgk-3dad": {
    id: "6bgk-3dad",
    name: "DOB ECB Violations",
    moduleHints: ["dob_permits"],
    url: "https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad",
    ttlSeconds: 900,
  },
  "tqtj-sjs8": {
    id: "tqtj-sjs8",
    name: "Street Construction Permits (2022-Present)",
    moduleHints: ["right_now", "street_works"],
    url: "https://data.cityofnewyork.us/Transportation/Street-Construction-Permits-2022-Present/tqtj-sjs8",
    ttlSeconds: 900,
  },
  "9jic-byiu": {
    id: "9jic-byiu",
    name: "Street Opening Permits",
    moduleHints: ["street_works"],
    url: "https://data.cityofnewyork.us/Transportation/Street-Opening-Permits/9jic-byiu",
    ttlSeconds: 900,
  },
  "i6b5-j7bu": {
    id: "i6b5-j7bu",
    name: "Street Closures due to construction activities by Block",
    moduleHints: ["right_now", "street_works"],
    url: "https://data.cityofnewyork.us/Transportation/Street-Closures-due-to-construction-activities-by-/i6b5-j7bu",
    ttlSeconds: 900,
  },
  "h9gi-nx95": {
    id: "h9gi-nx95",
    name: "Motor Vehicle Collisions - Crashes",
    moduleHints: ["collisions"],
    url: "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
    ttlSeconds: 900,
  },
  "erm2-nwe9": {
    id: "erm2-nwe9",
    name: "311 Service Requests from 2020 to Present",
    moduleHints: ["311_pulse"],
    url: "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9",
    ttlSeconds: 900,
  },
  "p7k6-2pm8": {
    id: "p7k6-2pm8",
    name: "Garbage Collection Schedule",
    moduleHints: ["sanitation"],
    url: "https://data.cityofnewyork.us/City-Government/Garbage-Collection-Schedule/p7k6-2pm8",
    ttlSeconds: 86400,
  },
  "rv63-53db": {
    id: "rv63-53db",
    name: "DSNY Frequencies",
    moduleHints: ["sanitation"],
    url: "https://data.cityofnewyork.us/City-Government/DSNY-Frequencies/rv63-53db",
    ttlSeconds: 86400,
  },
  "tvpp-9vvx": {
    id: "tvpp-9vvx",
    name: "NYC Permitted Event Information",
    moduleHints: ["events"],
    url: "https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx",
    ttlSeconds: 1800,
  },
  "5crt-au7u": {
    id: "5crt-au7u",
    name: "Community Districts",
    moduleHints: ["events"],
    url: "https://data.cityofnewyork.us/City-Government/Community-Districts/5crt-au7u",
    ttlSeconds: 86400,
  },
  "tg4x-b46p": {
    id: "tg4x-b46p",
    name: "Film Permits",
    moduleHints: ["right_now", "film"],
    url: "https://data.cityofnewyork.us/City-Government/Film-Permits/tg4x-b46p",
    ttlSeconds: 1800,
  },
};

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[];
