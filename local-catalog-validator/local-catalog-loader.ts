import * as RDF from "@rdfjs/types";

import { type FetchService } from "../service/fetch";
import { type JsonSchemaService } from "../service/json-schema";
import {
  detectContentType,
  ContentType,
  detectContentTypeWithoutSparql,
} from "../service/content-type";
import { jsonLdToRdf, streamN3ToRdf } from "../service/rdf";
import { validateWithShacl } from "../service/shacl";
import { type Logger } from "../service/logger";

import * as Model from "./local-catalog-loader-model";
import { LocalCatalog } from "./local-catalog-loader-model";
import * as Codelist from "./codelist";
import * as Vocabulary from "./vocabulary";

import CatalogShacl from "./specification/rozhraní-katalogů-otevřených-dat/2024-05-28/catalog.shacl";

import {
  OpenDataCatalogs20250428,
  HVD_JSON_SCHEMA_ID,
  DATASET_JSON_SCHEMA_ID,
  SERIES_JSON_SCHEMA_ID,
  CATALOG_JSON_SCHEMA_ID,
} from "./specification/rozhraní-katalogů-otevřených-dat";
import { CommonDataTypes20200701 } from "./specification/základní-datové-typy";

/**
 * This method should be called only once.
 * It adds all local schemas to the validation service.
 */
export function loadSchemasToJsonSchemaService(
  jsonSchema: JsonSchemaService,
): void {
  const schemas = [...OpenDataCatalogs20250428, ...CommonDataTypes20200701];
  for (const schema of schemas) {
    jsonSchema.addJsonSchema(schema);
  }
}

/**
 * Load information about local catalog and perform valiation using schemas,
 * like JSON schema and SHACL.
 */
export class LocalCatalogLoader {
  private readonly fetchService: FetchService;

  private readonly jsonSchema: JsonSchemaService;

  private readonly logger: Logger;

  constructor(
    fetchService: FetchService,
    jsonSchema: JsonSchemaService,
    logger: Logger,
  ) {
    this.fetchService = fetchService;
    this.jsonSchema = jsonSchema;
    this.logger = logger;
  }

  async load(url: string): Promise<LocalCatalog> {
    // Load entry point.
    const catalogLoader = new CatalogReader(
      this.fetchService,
      this.jsonSchema,
      this.logger,
      url,
    );
    await catalogLoader.load();
    const catalogEntry: Model.CatalogEntryPoint = catalogLoader.report;
    if (catalogLoader.quads === null) {
      // We were not able to convert this into RDF.
      return {
        catalog: {
          entryPoint: catalogEntry,
          catalogs: [],
        },
        datasets: [],
      };
    }
    // Validate and load catalog data.
    let catalogs: Model.Catalog[] = [];
    const catalogValidator = new CatalogLoader(catalogLoader.quads);
    await catalogValidator.load();
    catalogs = catalogValidator.reports;

    // We process all datasets at once.
    const datasets: Model.DatasetWrap[] = [];
    const collectedDatasets = this.collectDatasets(catalogs);
    this.logger.startProcessing(collectedDatasets.length);
    let index = 0;
    for (const datasetUrl of collectedDatasets) {
      this.logger.updateProcessing(++index);
      const datasetLoader = new DatasetReader(
        this.fetchService,
        this.jsonSchema,
        this.logger,
        catalogEntry,
        datasetUrl,
      );
      await datasetLoader.load();
      if (datasetLoader.quads === null) {
        // There is nothing to load.
        datasets.push({
          entryPoint: datasetLoader.report,
          datasets: [],
        });
      } else {
        const datasetValidator = new DatasetLoader(
          datasetLoader.quads,
          datasetUrl,
        );
        await datasetValidator.load();
        datasets.push({
          entryPoint: datasetLoader.report,
          datasets: datasetValidator.reports,
        });
      }
    }
    this.logger.endProcessing();
    // Return result.
    return {
      catalog: {
        entryPoint: catalogEntry,
        catalogs: catalogs,
      },
      datasets: datasets,
    };
  }

  private collectDatasets(catalogs: Model.Catalog[]): string[] {
    const result = new Set<string>();
    for (const catalog of catalogs) {
      for (const iri of catalog.datasets ?? []) {
        result.add(iri);
      }
    }
    return [...result];
  }
}

/**
 * Base class for loading resources.
 */
abstract class RdfResourceReader {
  protected readonly fetchService: FetchService;

  quads: RDF.Quad[] | null = null;

  constructor(fetchService: FetchService) {
    this.fetchService = fetchService;
  }

  protected async loadEntry(entry: Model.RdfEntryPoint): Promise<void> {
    await this.detectContentType(entry);
    const contentType = entry.contentType ?? entry.contentTypeFromUrl ?? null;
    if (contentType === null) {
      // There is nothing else we can do at this point.
      return;
    }
    switch (contentType) {
      case ContentType.JSONLD:
        await this.quadsFromJsonLd(entry);
        break;
      case ContentType.SPARQL:
        await this.quadsFromSparql(entry);
        break;
      case ContentType.TURTLE:
        await this.quadsFromTurtle(entry);
        break;
    }
  }

  protected async detectContentType(entry: Model.RdfEntryPoint): Promise<void> {
    const contentType = await detectContentType(this.fetchService, entry.url);
    entry.contentType = contentType.contentType;
    entry.headerContentType = contentType.rawHeaderContentType;
    entry.contentTypeStatusCode = contentType.statusCode;
    entry.contentTypeFromUrl = contentType.contentTypeFromUrl;
  }

  protected async quadsFromJsonLd(entry: Model.RdfEntryPoint): Promise<void> {
    const response = await this.fetchService.httpGetAsJson(entry.url);
    entry.fetchStatusCode = response.statusCode;
    if (response.payload === null) {
      entry.failedToFetchData = true;
      return;
    }
    entry.failedToFetchData = false;
    const document = response.payload;
    await this.validateJsonDocument(document);
    // Convert to RDF.
    try {
      this.quads = await jsonLdToRdf(document);
      entry.conversionToRdfFailed = false;
    } catch (error) {
      console.error("Conversion to RDF failed.", error);
      entry.conversionToRdfFailed = true;
    }
  }

  /**
   * Perform optiona validatino of JSON document.
   */
  protected abstract validateJsonDocument(document: object): Promise<void>;

  protected async quadsFromSparql(entry: Model.RdfEntryPoint): Promise<void> {
    const { endpoint, query } = this.createSparqlQuery(entry.url);
    try {
      this.quads = await this.fetchService.sparqlConstruct(endpoint, query);
      entry.failedToFetchData = false;
      entry.conversionToRdfFailed = false;
    } catch (error) {
      entry.failedToFetchData = true;
    }
  }

  /**
   * Return SPARQL query for loading the resource.
   */
  protected abstract createSparqlQuery(url: string): {
    endpoint: string;
    query: string;
  };

  protected async quadsFromTurtle(entry: Model.RdfEntryPoint): Promise<void> {
    const response = await this.fetchService.httpGetAsStream(entry.url);
    entry.fetchStatusCode = response.statusCode;
    if (response.payload === null) {
      entry.failedToFetchData = true;
      return;
    }
    entry.failedToFetchData = false;
    // Convert to RDF.
    try {
      this.quads = await streamN3ToRdf(response.payload.getReader(), "Turtle");
      entry.conversionToRdfFailed = false;
    } catch (error) {
      entry.conversionToRdfFailed = true;
    }
  }
}

/**
 * Customized loader for catalog.
 * Add special handling for JSON data where we walidate using JSON schema.
 */
export class CatalogReader extends RdfResourceReader {
  private readonly jsonSchema: JsonSchemaService;

  private readonly logger: Logger;

  report: Model.CatalogEntryPoint;

  constructor(
    fetchService: FetchService,
    jsonSchema: JsonSchemaService,
    logger: Logger,
    url: string,
  ) {
    super(fetchService);
    this.jsonSchema = jsonSchema;
    this.logger = logger;
    // Prepare default report.
    this.report = {
      url,
      contentType: null,
      headerContentType: null,
      contentTypeStatusCode: null,
      contentTypeFromUrl: null,
      failedToFetchData: null,
      fetchStatusCode: null,
      conversionToRdfFailed: null,
      validByShacl: null,
      isJsonFormat: false,
    };
  }

  async load(): Promise<void> {
    this.logger.info("logger.loading-catalog-entry-{catalog}", {
      catalog: this.report.url,
    });
    await super.loadEntry(this.report);
    // Perform additional validation.
    if (this.quads !== null) {
      this.report.validByShacl = await this.validateWithShacl(this.quads);
    }
  }

  protected async validateJsonDocument(document: object): Promise<void> {
    this.report.isJsonFormat = true;
    const entry = this.report as Model.JsonCatalogEntryPoint;
    const validation = await this.jsonSchema.validate(
      CATALOG_JSON_SCHEMA_ID,
      document,
    );
    entry.validByJsonSchema = validation.valid;
    entry.jsonSchemaErrors = validation.valid
      ? null
      : validation.errors ?? null;
    entry.canBeCkanApi =
      !entry.validByJsonSchema && this.canBeCkanApi(entry.url, document);
  }

  private canBeCkanApi(url: string, content: any) {
    const urlLooksLikeCkan = url.endsWith("/action/package_list");
    const contentLooksLikeCkan =
      content["success"] !== undefined && content["result"] !== undefined;
    return urlLooksLikeCkan && contentLooksLikeCkan;
  }

  private async validateWithShacl(quads: RDF.Quad[]): Promise<boolean> {
    return await (await validateWithShacl(quads)).validate(CatalogShacl);
  }

  protected createSparqlQuery(_: string) {
    // We can ignore url of the catalog.
    const query = `
PREFIX dcat: <http://www.w3.org/ns/dcat#>

CONSTRUCT {
  ?catalog ?catalogPredicate ?catalogObject .
} WHERE {
  ?catalog a dcat:Catalog ;
    ?catalogPredicate ?catalogObject .
}`;
    return {
      endpoint: this.report.url,
      query,
    };
  }
}

/**
 * Load content of the catalog as quads and create report about the loading.
 */
export class CatalogLoader {
  private readonly quads: RDF.Quad[];

  reports: Model.Catalog[] = [];

  constructor(quads: RDF.Quad[]) {
    this.quads = quads;
  }

  async load(): Promise<void> {
    for (const url of this.selectCatalogs()) {
      this.reports.push(await this.loadCatalog(url));
    }
  }

  private selectCatalogs(): string[] {
    const result: string[] = [];
    for (const {
      subject: { value: subject },
      predicate: { value: predicate },
      object: { value: object },
    } of this.quads) {
      if (predicate === Vocabulary.TYPE && object === Vocabulary.CATALOG) {
        result.push(subject);
      }
    }
    return result;
  }

  private async loadCatalog(url: string): Promise<Model.Catalog> {
    const title = selectLanguageString(this.quads, url, Vocabulary.HAS_TITLE);
    const description = selectLanguageString(
      this.quads,
      url,
      Vocabulary.HAS_DESCRIPTION,
    );
    return {
      url,
      title,
      description,
      publishers: await selectPublishers(this.quads, url),
      datasets: await this.selectDatasets(url),
    };
  }

  private selectDatasets(url: string): string[] {
    const result: string[] = [];
    for (const {
      subject: { value: subject },
      predicate: { value: predicate },
      object: { value: object },
    } of this.quads) {
      if (subject === url && predicate === Vocabulary.HAS_DATASET) {
        result.push(object);
      }
    }
    return result;
  }
}

/**
 * @param url
 * @param predicate
 * @returns Object with loaded language string.
 */
function selectLanguageString(
  quads: RDF.Quad[],
  url: string,
  predicate: string,
): Model.LanguageString {
  const result: Model.LanguageString = {};
  for (const {
    subject: { value: s },
    predicate: { value: p },
    object: o,
  } of quads) {
    if (s === url && p === predicate) {
      const literal = o as RDF.Literal;
      result[literal?.language] = literal?.value;
    }
  }
  return result;
}

function selectPublishers(quads: RDF.Quad[], url: string): Model.Publisher[] {
  return selectValues(quads, url, Vocabulary.HAS_PUBLISHER).map(url => ({
    url,
  }));
}

function selectValues(
  quads: RDF.Quad[],
  url: string,
  predicate: string,
): string[] {
  const result: string[] = [];
  for (const {
    subject: { value: s },
    predicate: { value: p },
    object: { value: o },
  } of quads) {
    if (s === url && p === predicate) {
      result.push(o);
    }
  }
  return result;
}

/**
 * Customized loader for dataset.
 * We force SPARQL when used by catalog.
 * We validate JSON documents using JSON-schema.
 */
export class DatasetReader extends RdfResourceReader {
  private readonly jsonSchema: JsonSchemaService;

  private readonly logger: Logger;

  private readonly catalogEntryPoint: Model.CatalogEntryPoint;

  report: Model.DatasetEntryPoint;

  constructor(
    fetchService: FetchService,
    jsonSchema: JsonSchemaService,
    logger: Logger,
    catalogEntryPoint: Model.CatalogEntryPoint,
    url: string,
  ) {
    super(fetchService);
    this.jsonSchema = jsonSchema;
    this.logger = logger;
    this.catalogEntryPoint = catalogEntryPoint;
    // Prepare default report.
    this.report = {
      url,
      contentType: null,
      headerContentType: null,
      contentTypeStatusCode: null,
      contentTypeFromUrl: null,
      failedToFetchData: null,
      fetchStatusCode: null,
      conversionToRdfFailed: null,
      isJsonFormat: false,
    };
  }

  async load(): Promise<void> {
    this.logger.info("logger.loading-dataset-entry-{dataset}", {
      dataset: this.report.url,
    });
    await super.loadEntry(this.report);
  }

  protected async detectContentType(entry: Model.RdfEntryPoint): Promise<void> {
    // When we are using SPARQL endpoint for catalog, we force it for entry as well.
    if (this.catalogEntryPoint.contentType === ContentType.SPARQL) {
      entry.contentType = ContentType.SPARQL;
    } else {
      const contentType = await detectContentTypeWithoutSparql(
        this.fetchService,
        entry.url,
      );
      entry.contentType = contentType.contentType;
      entry.headerContentType = contentType.rawHeaderContentType;
      entry.contentTypeStatusCode = contentType.statusCode;
      entry.contentTypeFromUrl = contentType.contentTypeFromUrl;
    }
  }

  protected async validateJsonDocument(document: object): Promise<void> {
    const entry = this.report as Model.JsonDatasetEntryPoint;
    entry.isJsonFormat = true;
    entry.validByHvdJsonSchema = null;
    entry.validByDatasetJsonSchema = null;
    entry.validBySeriesJsonSchema = null;
    entry.hvdJsonSchemaErrors = null;
    entry.datasetJsonSchemaErrors = null;
    entry.seriesJsonSchemaErrors = null;
    // Instead of validating using all schemas we try to determine type,
    // using distinct features.
    if (document["typ"] === "Datová sada") {
      // Validate as dataset.
      const datasetValidation = await this.jsonSchema.validate(
        DATASET_JSON_SCHEMA_ID,
        document,
      );
      entry.validByDatasetJsonSchema = datasetValidation.valid;
      entry.datasetJsonSchemaErrors = datasetValidation.valid
        ? null
        : datasetValidation.errors ?? null;
      // But also check as it can be HVD.
      const legal = document["právní_předpis"] ?? null;
      if (
        Array.isArray(legal) &&
        legal.findIndex(Codelist.isApplicableLegislationHvd) !== -1
      ) {
        const hvdValidation = await this.jsonSchema.validate(
          HVD_JSON_SCHEMA_ID,
          document,
        );
        entry.validByHvdJsonSchema = hvdValidation.valid;
        entry.hvdJsonSchemaErrors = hvdValidation.valid
          ? null
          : hvdValidation.errors ?? null;
      }
    }
    if (document["typ"] === "Datová série") {
      const seriesValidation = await this.jsonSchema.validate(
        SERIES_JSON_SCHEMA_ID,
        document,
      );
      entry.validBySeriesJsonSchema = seriesValidation.valid;
      entry.seriesJsonSchemaErrors = seriesValidation.valid
        ? null
        : seriesValidation.errors ?? null;
    }
  }

  protected createSparqlQuery(url: string) {
    // We can ignore url of the catalog.
    const query = `
    PREFIX dcat: <http://www.w3.org/ns/dcat#>
    PREFIX pu: <https://data.gov.cz/slovník/podmínky-užití/>

    CONSTRUCT {
      <${url}> ?p ?o .
      ?distributionS ?distributionP ?distributionO .
      ?podmínkyS ?podmínkyP ?podmínkyO .
      ?serviceS ?serviceP ?serviceO .
    } WHERE {
      <${url}> ?p ?o .

      OPTIONAL {
        <${url}> dcat:distribution ?distributionS .
        ?distributionS ?distributionP ?distributionO .
      }

      OPTIONAL {
        <${url}> dcat:distribution ?distributionS .
        ?distributionS pu:specifikace ?podmínkyS .
        ?podmínkyS ?podmínkyP ?podmínkyO .
      }

      OPTIONAL {
        <${url}> dcat:distribution ?distributionS .
        ?distributionS dcat:accessService ?serviceS .
        ?serviceS ?serviceP ?serviceO .
      }
    }`;

    return {
      // We need to use endpoint from the catalog.
      endpoint: this.catalogEntryPoint.url,
      query,
    };
  }
}

export class DatasetLoader {
  private readonly quads: RDF.Quad[];

  reports: Model.Dataset[] = [];

  url: string;

  constructor(quads: RDF.Quad[], url: string) {
    this.quads = quads;
    this.url = url;
  }

  load(): void {
    const urls = this.selectDatasets();
    for (const url of urls) {
      this.reports.push(this.loadDataset(url));
    }
    if (!urls.includes(this.url)) {
      this.reports.push(this.loadDataset(this.url));
    }
  }

  private selectDatasets(): string[] {
    const result: string[] = [];
    for (const {
      subject: { value: s },
      predicate: { value: p },
      object: { value: o },
    } of this.quads) {
      if (p === Vocabulary.TYPE && o === Vocabulary.DATASET) {
        result.push(s);
      }
    }
    return result;
  }

  private loadDataset(url: string): Model.Dataset {
    const types = selectValues(this.quads, url, Vocabulary.TYPE);
    const title = selectLanguageString(this.quads, url, Vocabulary.HAS_TITLE);
    const description = selectLanguageString(
      this.quads,
      url,
      Vocabulary.HAS_DESCRIPTION,
    );
    const keywords = selectLanguageStringAsArray(
      this.quads,
      url,
      Vocabulary.HAS_KEYWORD,
    );
    const themes = selectValues(this.quads, url, Vocabulary.HAS_THEME);
    const accrualPeriodicities = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_ACCRUAL_PERIODICITY,
    );
    const spatials = selectValues(this.quads, url, Vocabulary.HAS_SPATIAL);
    const applicableLegislations = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_APPLICABLE_LEGISLATION,
    );
    const inSeries = selectValues(this.quads, url, Vocabulary.HAS_IN_SERIES);
    const distributions = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_DISTRIBUTION,
    );

    const report: Model.Dataset = {
      url,
      hasDatasetClass: types.includes(Vocabulary.DATASET),
      hasDatasetSeriesClass: types.includes(Vocabulary.DATASET_SERIES),
      title,
      description,
      publishers: selectPublishers(this.quads, url),
      keywords: keywords,
      themes,
      accrualPeriodicities,
      spatials,
      distributions: distributions.map(iri => this.loadDistribution(iri)),
      applicableLegislations,
      inSeries,
      isHighValue: false,
    };

    const isHvdDataset =
      applicableLegislations.findIndex(Codelist.isApplicableLegislationHvd) !==
      -1;
    if (isHvdDataset) {
      // Perform additional validation.
      return this.loadHighValueDataset(report);
    } else {
      return report;
    }
  }

  private loadDistribution(url: string): Model.Distribution {
    const termsOfUse = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_TERMS_OF_USE,
    );
    const applicableLegislations = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_APPLICABLE_LEGISLATION,
    );
    const accessService = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_ACCESS_SERVICE,
    );

    const report: Model.Distribution = {
      url,
      accessURLs: selectValues(this.quads, url, Vocabulary.HAS_ACCESS_URL),
      termsOfUse,
      applicableLegislations,
      isHighValue:
        applicableLegislations.findIndex(
          Codelist.isApplicableLegislationHvd,
        ) !== -1,
      isDataServiceDistribution: false,
      isFileDistribution: false,
    };

    if (accessService.length === 0) {
      return this.loadFileDistribution(report);
    } else {
      // It is a data service distribution.
      return this.loadDataServiceDistribution(report, accessService);
    }
  }

  private loadFileDistribution(
    distribution: Model.Distribution,
  ): Model.FileDistribution {
    const url = distribution.url;
    const result = distribution as Model.FileDistribution;
    result.isFileDistribution = true;
    result.downloadURLs = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_DOWNLOAD,
    );
    result.mediaTypes = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_MEDIA_TYPE,
    );
    result.formats = selectValues(this.quads, url, Vocabulary.HAS_FORMAT);
    return result;
  }

  private loadDataServiceDistribution(
    distribution: Model.Distribution,
    accessServices: string[],
  ): Model.DataServiceDistribution {
    // Just use the first one.
    const url = accessServices[0];
    const title = selectLanguageString(this.quads, url, Vocabulary.HAS_TITLE);
    const endpointURL = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_ENDPOINT_URL,
    );
    const contactPoints = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_CONTACT_POINT,
    );
    const pages = selectValues(this.quads, url, Vocabulary.HAS_PAGE);
    const applicableLegislations = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_APPLICABLE_LEGISLATION,
    );
    const hvdCategories = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_HVD_CATEGORY,
    );
    const isHighValue = applicableLegislations.findIndex(
      Codelist.isApplicableLegislationHvd,
    ) !== -1;
    // Turn distribution into DataServiceDistribution.
    const result = distribution as Model.DataServiceDistribution;
    result.isDataServiceDistribution = true;
    result.accessServicesUrl = accessServices;
    result.dataService = {
      url,
      title,
      endpointURL,
      contactPoints,
      pages,
      applicableLegislations,
      hvdCategories,
      isHighValue,
    };
    return result;
  }

  private loadHighValueDataset(initialReport: Model.Dataset): Model.HvdDataset {
    const url = initialReport.url;
    const hvdCategories = selectValues(
      this.quads,
      url,
      Vocabulary.HAS_HVD_CATEGORY,
    );
    const report: Model.HvdDataset = {
      ...initialReport,
      isHighValue: true,
      hvdCategories,
    };
    return report;
  }
}

function selectLanguageStringAsArray(
  quads: RDF.Quad[],
  url: string,
  predicate: string,
): Model.LanguageString[] {
  const result: Model.LanguageString[] = [];
  for (const {
    subject: { value: s },
    predicate: { value: p },
    object: o,
  } of quads) {
    if (s === url && p === predicate) {
      const literal = o as RDF.Literal;
      result.push({ [literal?.language]: literal?.value });
    }
  }
  return result;
}
