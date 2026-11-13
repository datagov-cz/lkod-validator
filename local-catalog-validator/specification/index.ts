import {
  CATALOG_JSON_SCHEMA_ID,
  CONTEXT_2024_05_28,
  DATASET_JSON_SCHEMA_ID,
  HVD_JSON_SCHEMA_ID,
  SERIES_JSON_SCHEMA_ID,
} from "./rozhraní-katalogů-otevřených-dat";
import {
  CATALOG_2026_09_23_CONTEXT,
  CATALOG_2026_09_23_JSON_SCHEMA_ID,
} from "./dcat-ap-cz-rozhraní-katalogů-dat";
import {
  DATASET_2026_09_23_JSON_SCHEMA_ID,
  SERIES_2026_09_23_JSON_SCHEMA_ID,
} from "./dcat-ap-cz-otevřená-data";
import {
  HVD_DATASET_2026_09_23_CONTEXT,
  HVD_DATASET_2026_09_23_JSON_SCHEMA_ID,
  HVD_SERIES_2026_09_23_CONTEXT,
  HVD_SERIES_2026_09_23_JSON_SCHEMA_ID,
} from "./dcat-ap-cz-hvd";

/**
 * Value of "typ" for a dataset, same in all versions.
 */
const DATASET_TYPE = "Datová sada";

/**
 * Value of "typ" for a dataset series in version 2024-05-28.
 */
const SERIES_TYPE_2024_05_28 = "Datová série";

/**
 * Value of "typ" for a dataset series since version 2026-09-23.
 */
const SERIES_TYPE_2026_09_23 = "Série datových sad";

/**
 * @returns True when "@context" of the document is, or contains, given IRI.
 */
function hasContext(document: any, context: string): boolean {
  return hasValue(document?.["@context"], context);
}

/**
 * @returns True when "typ" of the document is, or contains, given value.
 */
function hasType(document: any, type: string): boolean {
  return hasValue(document?.["typ"], type);
}

function hasValue(value: unknown, expected: string): boolean {
  if (Array.isArray(value)) {
    return value.includes(expected);
  }
  return value === expected;
}

/**
 * Open formal norm (OFN) a JSON schema belongs to.
 */
export interface Specification {
  title: string;

  version: string;

  url: string;
}

const CATALOG_SPECIFICATIONS: { [schema: string]: Specification } = {
  [CATALOG_JSON_SCHEMA_ID]: {
    title: "Rozhraní katalogů otevřených dat: DCAT-AP-CZ",
    version: "2024-05-28",
    url: "https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/",
  },
  [CATALOG_2026_09_23_JSON_SCHEMA_ID]: {
    title: "DCAT-AP-CZ: Rozhraní katalogů dat",
    version: "2026-09-23",
    url: "https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-dat/2026-09-23/",
  },
};

/**
 * @returns Specification for given catalog JSON schema or null.
 */
export function catalogSpecification(
  jsonSchemaId: string,
): Specification | null {
  return CATALOG_SPECIFICATIONS[jsonSchemaId] ?? null;
}

/**
 * Select JSON schema for a catalog document.
 * Documents using the 2024-05-28 context are validated using
 * the 2024-05-28 schema, all other documents using the current one.
 */
export function selectCatalogJsonSchema(document: object): string {
  if (
    hasContext(document, CONTEXT_2024_05_28) &&
    !hasContext(document, CATALOG_2026_09_23_CONTEXT)
  ) {
    return CATALOG_JSON_SCHEMA_ID;
  }
  return CATALOG_2026_09_23_JSON_SCHEMA_ID;
}

export interface DatasetJsonSchemas {
  /**
   * Schema to validate the document as a dataset, or null.
   */
  dataset: string | null;

  /**
   * Schema to validate the document as a high value dataset, or null.
   * Used only for documents that refer to the HVD legislation.
   */
  hvd: string | null;
}

/**
 * Select JSON schemas for a document with dataset type.
 *
 * In version 2026-09-23 high value datasets have their own JSON-LD context
 * and their own self-contained JSON schema, see
 * https://ofn.gov.cz/dcat-ap-cz-hvd/2026-09-23/ .
 */
export function selectDatasetJsonSchemas(
  document: object,
): DatasetJsonSchemas | null {
  if (!hasType(document, DATASET_TYPE)) {
    return null;
  }
  if (hasContext(document, HVD_DATASET_2026_09_23_CONTEXT)) {
    return { dataset: null, hvd: HVD_DATASET_2026_09_23_JSON_SCHEMA_ID };
  }
  if (hasContext(document, CONTEXT_2024_05_28)) {
    return { dataset: DATASET_JSON_SCHEMA_ID, hvd: HVD_JSON_SCHEMA_ID };
  }
  return {
    dataset: DATASET_2026_09_23_JSON_SCHEMA_ID,
    hvd: HVD_DATASET_2026_09_23_JSON_SCHEMA_ID,
  };
}

/**
 * Select JSON schema for a document with dataset series type.
 */
export function selectSeriesJsonSchema(document: object): string | null {
  if (hasContext(document, HVD_SERIES_2026_09_23_CONTEXT)) {
    return HVD_SERIES_2026_09_23_JSON_SCHEMA_ID;
  }
  if (hasType(document, SERIES_TYPE_2026_09_23)) {
    return SERIES_2026_09_23_JSON_SCHEMA_ID;
  }
  if (hasType(document, SERIES_TYPE_2024_05_28)) {
    return hasContext(document, CONTEXT_2024_05_28)
      ? SERIES_JSON_SCHEMA_ID
      : SERIES_2026_09_23_JSON_SCHEMA_ID;
  }
  return null;
}
