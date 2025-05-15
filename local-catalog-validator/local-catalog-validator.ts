import { ContentType } from "../service/content-type";
import * as Codelist from "./codelist";
import * as Loader from "./local-catalog-loader-model";
import * as Model from "./local-catalog-validator-model";

export function createLocalCatalogReport(
  report: Loader.LocalCatalog,
): Model.LocalCatalogReport {
  const loadingFailure = reportToLoadingFailure(report);
  const catalogs = reportToCatalogs(report);
  const resources = reportToEntries(report);
  return {
    loadingFailure,
    summary: createSummary(report, catalogs, resources),
    catalogs: catalogs,
    datasets: resources,
  };
}

function reportToLoadingFailure(
  report: Loader.LocalCatalog,
): Model.LoadingFailure | null {
  const entryPoint = report.catalog.entryPoint;
  if (
    entryPoint.contentType !== null &&
    !entryPoint.failedToFetchData &&
    !entryPoint.conversionToRdfFailed
  ) {
    return null;
  }
  return {
    headerContentType: entryPoint.headerContentType,
    contentTypeStatusCode: entryPoint.contentTypeStatusCode,
    failedToFetchData: entryPoint.failedToFetchData,
    fetchStatusCode: entryPoint.fetchStatusCode,
    conversionToRdfFailed: entryPoint.conversionToRdfFailed,
  };
}

function reportToCatalogs(report: Loader.LocalCatalog): Model.Catalog[] {
  return report.catalog.catalogs.map(catalog => ({
    sourceUrl: report.catalog.entryPoint.url,
    iri: catalog.url,
    czechTitle: selectCzechValue(catalog.title),
    withoutCzechTitle: !hasCzechValue(catalog.title),
    withoutCzechDescription: !hasCzechValue(catalog.description),
    withoutPublisher: catalog.publishers.length === 0,
    withPublisherButNotOvm: notEmptyAndWithout(catalog.publishers, publisher =>
      Codelist.isPublisherOvm(publisher.url),
    ),
  }));
}

/**
 * @param string
 * @returns Value with Czech language.
 */
function selectCzechValue(string: Loader.LanguageString | null): string | null {
  return string?.["cs"] ?? null;
}

/**
 * @param string
 * @returns True when there is Czech content.
 */
function hasCzechValue(string: Loader.LanguageString | null): boolean {
  return string?.["cs"] !== undefined;
}

/**
 * @param array
 * @param predicate
 * @returns True if value is not empty and does not contain value that would passing predicate.
 */
function notEmptyAndWithout<T>(array: T[], predicate: (item: T) => boolean) {
  if (array.length === 0) {
    return false;
  }
  return array.findIndex(item => predicate(item)) === -1;
}

function includes<T>(array: T[], predicate: (item: T) => boolean) {
  return array.findIndex(item => predicate(item)) !== -1;
}

function reportToEntries(
  report: Loader.LocalCatalog,
): Model.DatasetReference[] {
  return report.datasets.map(createDatasetReference);
}

function createDatasetReference(
  wrap: Loader.DatasetWrap,
): Model.DatasetReference {
  const entry = wrap.entryPoint;
  const failedToDetectContentType =
    (entry.contentType ?? entry.contentTypeFromUrl ?? null) === null;
  const failedToFetch = entry.failedToFetchData;
  const failedToConvertToRdf = entry.conversionToRdfFailed;
  const isEmpty = !failedToConvertToRdf && wrap.datasets.length === 0;

  // Handling of JSON documents.
  let isJsonDocument = false;
  let validByHvdJsonSchema: boolean | null = null;
  let validByDatasetJsonSchema: boolean | null = null;
  let validBySeriesJsonSchema: boolean | null = null;
  if (Loader.isJsonDatasetEntryPoint(entry)) {
    isJsonDocument = true;
    validByHvdJsonSchema = entry.validByHvdJsonSchema;
    validByDatasetJsonSchema = entry.validByDatasetJsonSchema;
    validBySeriesJsonSchema = entry.validBySeriesJsonSchema;
  }

  const datasets = wrap.datasets.map(dataset => createDataset(entry, dataset));

  return populateDatasetReferenceIssues({
    contentType: entry.contentType ?? entry.contentTypeFromUrl ?? null,
    accessUrl: entry.url,
    failedToDetectContentType,
    failedToFetch,
    failedToConvertToRdf,
    isEmpty,
    isJsonDocument,
    validByHvdJsonSchema,
    validByDatasetJsonSchema,
    validBySeriesJsonSchema,
    datasets,
    issues: [],
  });
}

function populateDatasetReferenceIssues(
  resource: Model.DatasetReference,
): Model.DatasetReference {
  if (resource.failedToDetectContentType) {
    return {
      ...resource,
      issues: [
        {
          level: Model.Level.CRITICAL,
          payload: "issues.resource.failed-to-determine-content-type",
        },
      ],
    };
  } else if (resource.failedToFetch) {
    let message = "issues.resource.failed-to-fetch";
    switch (resource.contentType) {
      case ContentType.JSONLD:
        message = "issues.resource.failed-to-fetch-JSONLD";
        break;
      case ContentType.SPARQL:
        message = "issues.resource.failed-to-fetch-SPARQL";
        break;
      case ContentType.TURTLE:
        message = "issues.resource.failed-to-fetch-TURTLE";
        break;
      default:
        break;
    }
    return {
      ...resource,
      issues: [
        {
          level: Model.Level.CRITICAL,
          payload: message,
        },
      ],
    };
  } else if (resource.failedToConvertToRdf) {
    return {
      ...resource,
      issues: [
        {
          level: Model.Level.CRITICAL,
          payload: "issues.resource.failed-to-convert-to-rdf",
        },
      ],
    };
  }

  const issues: Model.Issue[] = [];
  if (resource.isEmpty) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.resource.no-dataset-found",
    });
  }
  if (resource.validByHvdJsonSchema === false) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.resource.is-json-but-not-valid-by-hvd-json-schema",
    });
  }
  if (resource.validByDatasetJsonSchema === false) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.resource.is-json-but-not-valid-by-dataset-json-schema",
    });
  }
  if (resource.validBySeriesJsonSchema === false) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.resource.is-json-but-not-valid-by-series-json-schema",
    });
  }

  return {
    ...resource,
    issues,
  };
}

function createDataset(
  entry: Loader.DatasetEntryPoint,
  dataset: Loader.Dataset,
): Model.Dataset {
  const withoutCzechTitle = !hasCzechValue(dataset.title);
  const withoutCzechDescription = !hasCzechValue(dataset.description);
  const withoutPublisher = dataset.publishers.length === 0;
  const withPublisherButNotOvm = notEmptyAndWithout(
    dataset.publishers,
    publisher => Codelist.isPublisherOvm(publisher.url),
  );
  const withoutAccrualPeriodicity = dataset.accrualPeriodicities.length === 0;
  const withAccrualPeriodicityButNotEurovoc = notEmptyAndWithout(
    dataset.accrualPeriodicities,
    Codelist.isFromAccrualPeriodicityCodelist,
  );
  const withoutSpatial = dataset.spatials.length === 0;
  const withSpatialButNotFromRuian = notEmptyAndWithout(
    dataset.spatials,
    Codelist.isFromRuianCodelist,
  );
  const withoutTheme = dataset.themes.length === 0;
  const withThemeButNotFromEurovoc = notEmptyAndWithout(
    dataset.themes,
    Codelist.isEurovocTheme,
  );
  const withoutKeyword = dataset.keywords.length === 0;
  const withKeywordButNotCzech = notEmptyAndWithout(
    dataset.keywords,
    hasCzechValue,
  );
  const distributions = dataset.distributions.map(createDistribution);
  const highValue = Loader.isHvdDataset(dataset)
    ? createHighValueDataset(dataset)
    : null;
  const datasetSeries = dataset.hasDatasetSeriesClass
    ? createDatasetSeries()
    : null;

  //
  return populateDatasetEntrySectionIssues({
    accessUrl: entry.url,
    iri: dataset.url,
    withoutType: !dataset.hasDatasetClass && !dataset.hasDatasetSeriesClass,
    withoutCzechTitle,
    withoutCzechDescription,
    withoutPublisher,
    withPublisherButNotOvm,
    withoutAccrualPeriodicity,
    withAccrualPeriodicityButNotFromEurovoc:
      withAccrualPeriodicityButNotEurovoc,
    withoutSpatial,
    withSpatialButNotFromRuian,
    withoutTheme,
    withThemeButNotFromEurovoc,
    withoutKeyword,
    withKeywordButNotCzech,
    highValue,
    datasetSeries,
    distributions,
    issues: [],
  });
}

function createHighValueDataset(
  report: Loader.HvdDataset,
): Model.HighValueDataset {
  const withoutHvdCategory = report.hvdCategories.length === 0;
  const withHvdTopCategory = includes(
    report.hvdCategories,
    Codelist.isTopHvdCategory,
  );
  // Search for a valid distribution.
  const hvdDistribution = report.distributions.find((item) => item.isHighValue);
  const withoutHvdDistribution = hvdDistribution === undefined;
  //
  return {
    withoutHvdCategory,
    withHvdTopCategory,
    withoutHvdDistribution,
  };
}

function createDatasetSeries(): Model.DatasetSeries {
  // There is no additional validation here.
  return {};
}

function populateDatasetEntrySectionIssues(
  dataset: Model.Dataset,
): Model.Dataset {
  const issues: Model.Issue[] = [...dataset.issues];

  if (dataset.withoutType) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-type",
      args: { dataset: dataset.iri },
    });
  }

  if (dataset.withoutCzechTitle) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-czech-title",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutCzechDescription) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-czech-description",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutPublisher) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-publisher",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withPublisherButNotOvm) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.dataset.missing-ovm-publisher",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutAccrualPeriodicity) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-accrual-periodicity",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withAccrualPeriodicityButNotFromEurovoc) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.dataset.missing-eurovoc-accrual-periodicity",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutSpatial) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-spatial",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withSpatialButNotFromRuian) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.dataset.missing-ruian-spatial",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutTheme) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-theme",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withThemeButNotFromEurovoc) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-eurovoc-theme",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withoutKeyword) {
    issues.push({
      level: Model.Level.ERROR,
      payload: "issues.dataset.missing-keyword",
      args: { dataset: dataset.iri },
    });
  }
  if (dataset.withKeywordButNotCzech) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.dataset.missing-czech-keyword",
      args: { dataset: dataset.iri },
    });
  }

  if (dataset.highValue !== null) {
    issues.push({
      level: Model.Level.SUCCESS,
      payload: "issues.dataset.this-is-hvd",
      args: { dataset: dataset.iri },
    });
    if (dataset.highValue.withoutHvdCategory) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.dataset.missing-hvd-category",
        args: { dataset: dataset.iri },
      });
    }
    if (dataset.highValue.withHvdTopCategory) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.dataset.contains-hvd-top-category",
        args: { dataset: dataset.iri },
      });
    }
    if (dataset.highValue.withoutHvdDistribution) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.dataset.missing-hvd-distribution-for-hvd-dataset",
      });
    }
  }

  // Distribution validation is more complex.
  if (dataset.distributions.length === 0) {
    if (dataset.datasetSeries === null) {
      issues.push({
        level: Model.Level.WARNING,
        payload: "issues.dataset.no-distribution-found",
        args: { dataset: dataset.iri },
      });
    }
  } else {
    if (dataset.datasetSeries !== null) {
      issues.push({
        level: Model.Level.SUCCESS,
        payload: "issues.dataset-series.distribution-found-but-not-expected",
        args: { dataset: dataset.iri },
      });
    }
  }

  return {
    ...dataset,
    issues,
  };
}

function createDistribution(report: Loader.Distribution): Model.Distribution {
  const withoutAccessURL = report.accessURLs.length === 0;
  const withoutTermsOfUse = report.termsOfUse.length === 0;
  const distribution = populateDistributionIssues({
    iri: report.url,
    withoutAccessURL,
    withoutTermsOfUse,
    issues: [],
  });
  if (Loader.isDataServiceDistribution(report)) {
    return expandToDataServiceDistribution(distribution, report);
  } else if (Loader.isFileDistribution(report)) {
    return expandToFileDistribution(distribution, report);
  } else {
    console.error("Invalid distribution type!", { report, distribution });
    return distribution;
  }
}

function populateDistributionIssues(
  distribution: Model.Distribution,
): Model.Distribution {
  const issues: Model.Issue[] = [...distribution.issues];

  if (distribution.withoutAccessURL) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.distribution.missing-access-url-{distribution}",
      args: { distribution: distribution.iri },
    });
  }

  if (distribution.withoutTermsOfUse) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.distribution.missing-terms-of-use-{distribution}",
      args: { distribution: distribution.iri },
    });
  }

  return {
    ...distribution,
    issues,
  };
}

function expandToDataServiceDistribution(
  distribution: Model.Distribution,
  report: Loader.DataServiceDistribution,
): Model.DataServiceDistribution {
  const withoutCzechTitle = !hasCzechValue(report.dataService.title);
  const withoutEndpointURL = report.dataService.endpointURL.length === 0;
  const highValue = report.isHighValue
    ? createHighValueDataServiceDistribution(report)
    : null;
  //
  return populateDataServiceDistributionIssues({
    ...distribution,
    isDataServiceDistribution: true,
    dataServiceIri: report.dataService.url,
    withoutCzechTitle,
    withoutEndpointURL,
    highValue,
  });
}

function populateDataServiceDistributionIssues(
  dataService: Model.DataServiceDistribution,
): Model.DataServiceDistribution {
  const issues: Model.Issue[] = [...dataService.issues];

  if (dataService.withoutCzechTitle) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.data-service.missing-czech-title-{data-service}",
      args: { "data-service": dataService.dataServiceIri },
    });
  }

  if (dataService.highValue) {

    if (dataService.withoutEndpointURL) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.missing-endpoint-url-{data-service}",
        args: { "data-service": dataService.dataServiceIri },
      });
    }

    if (dataService.highValue.withoutHvdCategory) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.missing-hvd-category-{data-service}",
        args: { "data-service": dataService.dataServiceIri },
      });
    }

    if (dataService.highValue.withHvdTopCategory) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.using-hvd-top-category-{data-service}",
        args: { "data-service": dataService.dataServiceIri },
      });
    }

    if (dataService.highValue.withoutContactPoint) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.missing-contact-point-{data-service}",
        args: { "data-service": dataService.dataServiceIri },
      });
    }

    if (dataService.highValue.withoutPage) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.missing-page-{data-service}",
        args: { "data-service": dataService.dataServiceIri },
      });
    }

    /**
     * We inherit high value flag from the distribution.
     * Yet we require use of legislation also on the level of a
     * data service.
     */
    if (!dataService.highValue.isHighValue) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.data-service.missing-legislation-for-hvd-{data-service}",
        args: { "data-service": dataService.iri },
      });
    }

  }

  return {
    ...dataService,
    issues,
  };
}

function createHighValueDataServiceDistribution(
  report: Loader.DataServiceDistribution,
): Model.HighValueDataServiceDistribution {
  const dataService = report.dataService;
  const withoutHvdCategory = dataService.hvdCategories.length === 0;
  const withHvdTopCategory = includes(
    dataService.hvdCategories,
    Codelist.isTopHvdCategory,
  );
  const withoutContactPoint = dataService.contactPoints.length === 0;
  const withoutPage = dataService.pages.length === 0;
  //
  return {
    isHighValue: dataService.isHighValue,
    withoutHvdCategory,
    withHvdTopCategory,
    withoutContactPoint,
    withoutPage,
  };
}

function expandToFileDistribution(
  distribution: Model.Distribution,
  report: Loader.FileDistribution,
): Model.FileDistribution {
  const withoutDownloadURL = report.downloadURLs.length === 0;
  const withoutMediaTypes = report.mediaTypes.length === 0;
  const withMediaTypeButNotFromCodelist = notEmptyAndWithout(
    report.mediaTypes,
    Codelist.isFromMediaTypeCodelist,
  );
  const withoutFormat = report.formats.length === 0;
  const withFormatButNotFromCodelist = notEmptyAndWithout(
    report.formats,
    Codelist.isFromFormatCodelist,
  );
  const highValue = report.isHighValue
    ? createHighValueFileDistribution()
    : null;
  //
  return {
    ...distribution,
    isFileDistribution: true,
    withoutDownloadURL,
    withoutMediaTypes,
    withMediaTypeButNotFromCodelist,
    withoutFormat,
    withFormatButNotFromCodelist,
    highValue,
  };
}

function createHighValueFileDistribution(): Model.HighValueFileDistribution {
  return {};
}

function createSummary(
  report: Loader.LocalCatalog,
  catalogs: Model.Catalog[],
  entries: Model.DatasetReference[],
): Model.Summary {
  const entryPoint = report.catalog.entryPoint;
  const contentType =
    entryPoint.contentType ?? entryPoint.contentTypeFromUrl ?? null;
  const isContentTypeFromExtension = entryPoint.contentType === null;
  const isInvalidByShacl = entryPoint.validByShacl === false;
  let isInvalidByJsonSchema: boolean | null = null;
  let canBeCkanApi = false;
  if (Loader.isJsonCatalogEntryPoint(entryPoint)) {
    isInvalidByJsonSchema = !entryPoint.validByJsonSchema;
    canBeCkanApi = entryPoint.canBeCkanApi;
  }
  //
  const foundCatalogUrls = catalogs.map(catalog => catalog.iri);
  const expectedCatalogUrl = entryPoint.url;
  //
  const resourcesWithError = entries
    .filter(entry => Model.includesErrorOrHigher(entry.issues))
    .map(entry => entry.accessUrl);

  const allFoundDatasets = entries.map(entry => entry.datasets).flat(1);

  const datasetsWithError = allFoundDatasets
    .filter(dataset => Model.includesErrorOrHigher(dataset.issues))
    .map(entry => entry.iri);

  const datasetsWithOnlyWarning = allFoundDatasets
    .filter(dataset => Model.includesWarningNotHigher(dataset.issues))
    .map(entry => entry.iri);

  const highValueDatasets = allFoundDatasets
    .filter(dataset => dataset.highValue !== null)
    .map(entry => entry.iri);

  return populateSummaryIssues({
    contentType,
    isContentTypeFromExtension,
    isInvalidByShacl,
    isInvalidByJsonSchema,
    canBeCkanApi,
    foundCatalogUrls,
    catalogs: catalogs,
    expectedCatalogUrl,
    resourcesWithError,
    allFoundDatasets: allFoundDatasets.map(entry => entry.iri),
    datasetsWithError,
    datasetsWithOnlyWarning,
    highValueDatasets,
    issues: [],
  });
}

function populateSummaryIssues(summary: Model.Summary): Model.Summary {
  const issues: Model.Issue[] = [];
  if (summary.isContentTypeFromExtension) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.summary.content-type-from-extension",
    });
  }
  if (summary.isInvalidByShacl) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.summary.invalid-shacl",
    });
  }
  if (summary.isInvalidByJsonSchema) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.summary.invalid-json-schema",
    });
  }
  if (summary.catalogs.length === 0) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.summary.missing-catalog",
    });
  }
  if (summary.catalogs.length > 1) {
    issues.push({
      level: Model.Level.WARNING,
      payload: "issues.summary.multiple-catalogs",
    });
  }

  for (const catalog of summary.catalogs) {
    if (catalog.withoutCzechTitle) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.summary.missing-czech-title",
      });
    }
    if (catalog.withoutCzechDescription) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.summary.missing-czech-description",
      });
    }
    if (catalog.withoutPublisher) {
      issues.push({
        level: Model.Level.ERROR,
        payload: "issues.summary.missing-publisher",
      });
    }
    if (catalog.withPublisherButNotOvm) {
      issues.push({
        level: Model.Level.WARNING,
        payload: "issues.summary.missing-ovm-publisher",
      });
    }
  }

  return {
    ...summary,
    issues,
  };
}
