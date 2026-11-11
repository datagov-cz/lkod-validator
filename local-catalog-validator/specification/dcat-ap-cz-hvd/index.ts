import HighValueDatasetJsonSchema from "./2026-09-23/datová-sada.json";
import HighValueDatasetSeriesJsonSchema from "./2026-09-23/série-datových-sad.json";

/**
 * DCAT-AP-CZ: Datové sady s vysokou hodnotou (HVD), verze 2026-09-23.
 * https://ofn.gov.cz/dcat-ap-cz-hvd/2026-09-23/
 */
export const HighValueDatasets20260923 = [
  HighValueDatasetJsonSchema,
  HighValueDatasetSeriesJsonSchema,
];

export const HVD_DATASET_2026_09_23_JSON_SCHEMA_ID =
  HighValueDatasetJsonSchema["$id"];

export const HVD_SERIES_2026_09_23_JSON_SCHEMA_ID =
  HighValueDatasetSeriesJsonSchema["$id"];

export const HVD_DATASET_2026_09_23_CONTEXT =
  "https://ofn.gov.cz/dcat-ap-cz-hvd/2026-09-23/datová-sada/kontext.jsonld";

export const HVD_SERIES_2026_09_23_CONTEXT =
  "https://ofn.gov.cz/dcat-ap-cz-hvd/2026-09-23/série-datových-sad/kontext.jsonld";
