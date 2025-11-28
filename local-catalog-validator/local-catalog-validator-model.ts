import { ContentType } from "../service/content-type";
import { type JsonSchemaValidationError } from "../service/json-schema";

export enum Level {
  /**
   * Information.
   */
  INFO = "info",
  /**
   * Something/all is as it should be.
   */
  SUCCESS = "success",
  /**
   * You should pay attention to this.
   */
  WARNING = "warning",
  /**
   * Error, but it should still work.
   */
  ERROR = "error",
  /**
   * This it not going to work.
   */
  CRITICAL = "critical",
}

const LevelSeverityMap = {
  [Level.INFO]: 0,
  [Level.SUCCESS]: 1,
  [Level.WARNING]: 2,
  [Level.ERROR]: 3,
  [Level.CRITICAL]: 4,
};

export function higherLevel(left: Level, right: Level): Level {
  return isLeftHigher(left, right) ? left : right;
}

export function isLeftHigher(left: Level, right: Level): boolean {
  return LevelSeverityMap[left] > LevelSeverityMap[right];
}

export function isLeftHigherOrEqual(left: Level, right: Level): boolean {
  return LevelSeverityMap[left] >= LevelSeverityMap[right];
}

export interface Issue {
  level: Level;

  /**
   * Payload to show to user.
   */
  payload: string;

  /**
   * Arguments for substitution.
   */
  args?: any;
}

export function includesErrorOrHigher(issues: Issue[]): boolean {
  for (const issue of issues) {
    switch (issue.level) {
      case Level.ERROR:
      case Level.CRITICAL:
        return true;
    }
  }
  return false;
}

export function includesWarningNotHigher(issues: Issue[]): boolean {
  let warning = false;
  for (const issue of issues) {
    switch (issue.level) {
      case Level.ERROR:
      case Level.CRITICAL:
        return false;
      case Level.WARNING:
        warning = true;
    }
  }
  return warning;
}

export function includesInfoOrLower(issues: Issue[]): boolean {
  for (const issue of issues) {
    switch (issue.level) {
      case Level.SUCCESS:
      case Level.INFO:
        break;
      default:
        return false;
    }
  }
  return true;
}

export interface LocalCatalogReport {
  loadingFailure: LoadingFailure | null;

  summary: Summary;

  catalogs: Catalog[];

  datasets: DatasetReference[];
}

/**
 * Provides detail information when we fail to load the catalog entry point.
 */
export interface LoadingFailure {
  headerContentType: string | null;

  contentTypeStatusCode: number | null;

  failedToFetchData: boolean | null;

  fetchStatusCode: number | null;

  conversionToRdfFailed: boolean | null;
}

export interface Summary {
  contentType: ContentType | null;

  isContentTypeFromExtension: boolean;

  isInvalidByShacl: boolean;

  isInvalidByJsonSchema: boolean | null;

  canBeCkanApi: boolean;

  //

  foundCatalogUrls: string[];

  expectedCatalogUrl: string;

  catalogs: Catalog[];

  //

  resourcesWithError: string[];

  //

  allFoundDatasets: string[];

  datasetsWithError: string[];

  datasetsWithOnlyWarning: string[];

  highValueDatasets: string[];

  //

  issues: Issue[];
}

export interface Catalog {
  sourceUrl: string;

  iri: string;

  czechTitle: string | null;

  // @lc-reference https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/#položky-katalog-název
  withoutCzechTitle: boolean;

  // @lc-reference https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/#položky-katalog-popis
  withoutCzechDescription: boolean;

  // @lc-reference https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/#položky-katalog-poskytovatel
  withoutPublisher: boolean;

  withPublisherButNotOvm: boolean;
}

/**
 * A referenced dataset resource.
 */
export interface DatasetReference {
  contentType: ContentType | null;

  accessUrl: string;

  failedToDetectContentType: boolean;

  failedToFetch: boolean | null;

  failedToConvertToRdf: boolean | null;

  isEmpty: boolean | null;

  isJsonDocument: boolean;

  validByDatasetJsonSchema: boolean | null;

  validByHvdJsonSchema: boolean | null;

  validBySeriesJsonSchema: boolean | null;

  datasetJsonSchemaErrors: JsonSchemaValidationError[] | null;

  hvdJsonSchemaErrors: JsonSchemaValidationError[] | null;

  seriesJsonSchemaErrors: JsonSchemaValidationError[] | null;

  /**
   * Datasets found in this entry.
   */
  datasets: Dataset[];

  /**
   * Issues are only related to this entity.
   */
  issues: Issue[];
}

export interface Dataset {
  accessUrl: string;

  iri: string;

  withoutType: boolean;

  withoutCzechTitle: boolean;

  withoutCzechDescription: boolean;

  withoutPublisher: boolean;

  withPublisherButNotOvm: boolean;

  withoutAccrualPeriodicity: boolean;

  withAccrualPeriodicityButNotFromEurovoc: boolean;

  withoutSpatial: boolean;

  withSpatialButNotFromRuian: boolean;

  withoutTheme: boolean;

  withThemeButNotFromEurovoc: boolean;

  withoutKeyword: boolean;

  withKeywordButNotCzech: boolean;

  highValue: HighValueDataset | null;

  datasetSeries: DatasetSeries | null;

  distributions: Distribution[];

  /**
   * Issues are only related to this entity.
   */
  issues: Issue[];
}

/**
 * Extra validation for high value datasets.
 */
export interface HighValueDataset {
  withoutHvdCategory: boolean;

  withHvdTopCategory: boolean;

  withoutHvdDistribution: boolean;

}

/**
 * Extra validation for dataset series.
 */
export interface DatasetSeries {}

/**
 * Distribution base interface, should not be used alone.
 */
export interface Distribution {
  iri: string;

  withoutAccessURL: boolean;

  withoutTermsOfUse: boolean;

  /**
   * Issues are only related to this entity.
   */
  issues: Issue[];
}

export interface DataServiceDistribution extends Distribution {
  isDataServiceDistribution: true;

  dataServiceIri: string;

  withoutCzechTitle: boolean;

  withoutEndpointURL: boolean;

  highValue: HighValueDataServiceDistribution | null;
}

export const isDataServiceDistribution = (
  distribution: Distribution,
): distribution is DataServiceDistribution => {
  return distribution["isDataServiceDistribution"] === true;
};

export interface HighValueDataServiceDistribution {

  /**
   * True when the data service entity is marked as high value using
   * legislation.
   */
  isHighValue: boolean;

  withoutHvdCategory: boolean;

  withHvdTopCategory: boolean;

  withoutContactPoint: boolean;

  withoutPage: boolean;
}

export interface FileDistribution extends Distribution {
  isFileDistribution: true;

  withoutDownloadURL: boolean;

  withoutMediaTypes: boolean;

  withMediaTypeButNotFromCodelist: boolean;

  withoutFormat: boolean;

  withFormatButNotFromCodelist: boolean;

  highValue: HighValueFileDistribution | null;
}

export interface HighValueFileDistribution {}

export const isFileDistribution = (
  distribution: Distribution,
): distribution is FileDistribution => {
  return distribution["isFileDistribution"] === true;
};
