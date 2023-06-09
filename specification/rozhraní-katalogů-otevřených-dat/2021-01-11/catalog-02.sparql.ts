import { CatalogSparqlValidator } from "../../specification";

const validator: CatalogSparqlValidator = async ({ ask, reporter }) => {
  const query = createQuery();
  if (await ask(query)) {
    reporter.info("sparql.group", "specification.has-dataset");
  } else {
    reporter.error("sparql.group", "specification.has-no-dataset");
  }
};

export default validator;

const createQuery = () => `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
ASK {
  [] a dcat:Catalog ;
    dcat:dataset [] .
}`;
