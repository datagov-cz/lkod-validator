# Test

This directory contains python script to serve static content in public directory.
The content in public directory can be used to test the functionality of the validator.

# Tests

## catalog-000

[Link](http://localhost:9090/catalog-000.jsonld)
Valid but empty catalog.
Should pass all test except SHACL.

## catalog-001

[Link](http://localhost:9090/catalog-001.jsonld)
Catalog without datasets and with missing czech title and description.

## catalog-002

[Link](http://localhost:9090/catalog-002.jsonld)
Catalog without datasets and with missing czech title and description and publisher.
The publisher also cause invalid json-schema.

## catalog-003

[Link](http://localhost:9090/catalog-003.jsonld)
Valid catalog with various datasets.

## catalog-005

[Link](http://localhost:9090/catalog-005.jsonld)
Catalog according to DCAT-AP-CZ 2026-09-23 with datasets taken from the examples of the specifications.
Datasets `catalog-005-000` to `catalog-005-004` (dataset, series, dataset in series, HVD dataset, HVD series) should be valid.
Dataset `catalog-005-005` misses `právní_předpis` and `catalog-005-006` is HVD dataset using open data context, both should fail JSON schema validation.
The catalog itself fails JSON schema validation only as the dataset IRIs are not using HTTPS.

## catalog-006

[Link](http://localhost:9090/catalog-006.jsonld)
Same as catalog-005 but without `přístupový_bod`, which is required since DCAT-AP-CZ 2026-09-23.
