import { type ContentType } from "../service/content-type";
import { type JsonSchemaValidationError } from "../service/json-schema";

export interface LocalCatalog {
  catalog: CatalogWrap;

  datasets: DatasetWrap[];
}

/**
 * Pair access data and catalog information.
 */
export interface CatalogWrap {
  entryPoint: CatalogEntryPoint;

  /**
   * There can be multiple catalogs stored under given URL.
   */
  catalogs: Catalog[];
}

export interface CatalogEntryPoint extends RdfEntryPoint {
  isJsonFormat: boolean;

  validByShacl: boolean | null;
}

export interface RdfEntryPoint {
  /**
   * URL to access the given resource.
   * The URL may accessed directly or used as a part of a query, e.g. SPARQL.
   */
  url: string;

  /**
   * Content type determined by using HTTP method.
   */
  contentType: ContentType | null;

  /**
   * Content type from HTTP header.
   */
  headerContentType: string | null;

  /**
   * Response code of HTTP request used to get content type.
   */
  contentTypeStatusCode: number | null;

  /**
   * Content type determined using URL suffix like file extension.
   * Should be used as a backup when there is no other way to determine URL.
   */
  contentTypeFromUrl: ContentType | null;

  /**
   * True when we were unable to fetch the data.
   */
  failedToFetchData: boolean | null;

  /**
   * Status code of a fetch request.
   */
  fetchStatusCode: number | null;

  /**
   * True when conversion to RDF failed.
   */
  conversionToRdfFailed: boolean | null;
}

export interface JsonCatalogEntryPoint extends CatalogEntryPoint {
  isJsonFormat: true;

  /**
   * True when validation by JSON schema was successful.
   */
  validByJsonSchema: boolean;

  /**
   * Validation errors when JSON schema validation fails.
   */
  jsonSchemaErrors: JsonSchemaValidationError[] | null;

  /**
   * True when API is not valid by JSON schema and it looks like CKAN API.
   */
  canBeCkanApi: boolean;
}

export const isJsonCatalogEntryPoint = (
  entryPoint: CatalogEntryPoint,
): entryPoint is JsonCatalogEntryPoint => {
  return entryPoint.isJsonFormat === true;
};

export interface Catalog {
  /**
   * Detected catalog URLs.
   */
  url: string;

  /**
   * List of datasets referenced by the catalog.
   */
  datasets: string[];

  /**
   * Title.
   */
  title: LanguageString | null;

  /**
   * Description.
   */
  description: LanguageString | null;

  /**
   * There canbe multiple publishers..
   */
  publishers: Publisher[];
}

export type LanguageString = { [language: string]: string };

export interface Publisher {
  url: string;
}

/**
 * Pair access data and dataset information.
 */
export interface DatasetWrap {
  entryPoint: DatasetEntryPoint;

  datasets: Dataset[];
}

export interface DatasetEntryPoint extends RdfEntryPoint {
  isJsonFormat: boolean;
}

export interface JsonDatasetEntryPoint extends DatasetEntryPoint {
  isJsonFormat: true;

  /**
   * True if document pass validation using dataset JSON schema.
   */
  validByDatasetJsonSchema: boolean | null;

  datasetJsonSchemaErrors: JsonSchemaValidationError[] | null;

  /**
   * True if document pass validation using HVD JSON schema.
   */
  validByHvdJsonSchema: boolean | null;

  hvdJsonSchemaErrors: JsonSchemaValidationError[] | null;

  /**
   * True if document pass validation using series JSON schema.
   */
  validBySeriesJsonSchema: boolean | null;

  seriesJsonSchemaErrors: JsonSchemaValidationError[] | null;
}

export const isJsonDatasetEntryPoint = (
  entryPoint: DatasetEntryPoint,
): entryPoint is JsonDatasetEntryPoint => {
  return entryPoint.isJsonFormat === true;
};

export interface Dataset {
  /**
   * Dataset URL as loaded from the data.
   */
  url: string;

  /**
   * True when dcat:Dataset class is assigned to the resource.
   */
  hasDatasetClass: boolean;

  /**
   * True when dcat:DatasetSeries class is assigned to the resource.
   */
  hasDatasetSeriesClass: boolean;

  title: LanguageString | null;

  description: LanguageString | null;

  publishers: Publisher[];

  keywords: LanguageString[];

  themes: string[];

  accrualPeriodicities: string[];

  spatials: string[];

  distributions: Distribution[];

  applicableLegislations: string[];

  inSeries: string[];

  isHighValue: boolean;
}

export interface HvdDataset extends Dataset {
  isHighValue: true;

  hvdCategories: string[];
}

export const isHvdDataset = (dataset: Dataset): dataset is HvdDataset => {
  return dataset.isHighValue === true;
};

export interface Distribution {
  url: string;

  accessURLs: string[];

  termsOfUse: string[];

  applicableLegislations: string[];

  isHighValue: boolean;

  isDataServiceDistribution: boolean;

  isFileDistribution: boolean;
}

export interface DataServiceDistribution extends Distribution {
  isDataServiceDistribution: true;

  accessServicesUrl: string[];

  dataService: DataService;
}

export const isDataServiceDistribution = (
  distribution: Distribution,
): distribution is DataServiceDistribution => {
  return distribution.isDataServiceDistribution === true;
};

/**
 * We extracted properties here as there is a collision
 * with applicableLegislations od Distribution.
 */
export interface DataService {
  url: string;

  title: LanguageString | null;

  endpointURL: string[];

  contactPoints: string[];

  pages: string[];

  applicableLegislations: string[];

  hvdCategories: string[];

  isHighValue: boolean;
}

export interface FileDistribution extends Distribution {
  isFileDistribution: true;

  downloadURLs: string[];

  mediaTypes: string[];

  formats: string[];
}

export const isFileDistribution = (
  distribution: Distribution,
): distribution is FileDistribution => {
  return distribution.isFileDistribution === true;
};
