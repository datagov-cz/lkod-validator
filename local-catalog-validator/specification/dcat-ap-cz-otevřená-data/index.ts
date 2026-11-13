import DatasetJsonSchema from "./2026-09-23/datová-sada.json";
import DatasetSeriesJsonSchema from "./2026-09-23/série-datových-sad.json";

/**
 * DCAT-AP-CZ: Datové sady otevřených dat, verze 2026-09-23.
 * https://ofn.gov.cz/dcat-ap-cz-otevřená-data/2026-09-23/
 */
export const OpenData20260923 = [DatasetJsonSchema, DatasetSeriesJsonSchema];

export const DATASET_2026_09_23_JSON_SCHEMA_ID = DatasetJsonSchema["$id"];

export const SERIES_2026_09_23_JSON_SCHEMA_ID = DatasetSeriesJsonSchema["$id"];

export const DATASET_2026_09_23_CONTEXT =
  "https://ofn.gov.cz/dcat-ap-cz-otevřená-data/2026-09-23/datová-sada/kontext.jsonld";

export const SERIES_2026_09_23_CONTEXT =
  "https://ofn.gov.cz/dcat-ap-cz-otevřená-data/2026-09-23/série-datových-sad/kontext.jsonld";
