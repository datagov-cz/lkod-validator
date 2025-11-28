import { addSchema, validate } from "@hyperjump/json-schema";
import type { OutputUnit } from "@hyperjump/json-schema";
import { BASIC } from "@hyperjump/json-schema/experimental";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-2020-12";

export interface JsonSchemaService {
  addJsonSchema(jsonSchema: object): string;

  addJsonSchemaString(jsonSchema: string): string;

  validate(
    jsonSchemaIdentifier: string,
    value: unknown,
  ): Promise<JsonSchemaValidationResult>;
}

export const createJsonSchemaService = () => new DefaultJsonSchemaService();

export interface JsonSchemaValidationError extends OutputUnit {
  schemaFragment: unknown | null;
}

export interface JsonSchemaValidationResult {
  valid: boolean;

  errors: JsonSchemaValidationError[] | null;
}

class DefaultJsonSchemaService implements JsonSchemaService {
  private readonly schemaStore = new Map<string, any>();

  addJsonSchema(jsonSchema: object): string {
    const patchedSchema = patchJsonSchemaPattern(jsonSchema);
    addSchema(patchedSchema);
    if (typeof patchedSchema["$id"] === "string") {
      this.schemaStore.set(patchedSchema["$id"], patchedSchema);
    }
    return patchedSchema["$id"];
  }

  addJsonSchemaString(jsonSchema: string): string {
    const schemaObject = JSON.parse(jsonSchema);
    return this.addJsonSchema(schemaObject);
  }

  async validate(
    jsonSchemaIdentifier: string,
    value: any,
  ): Promise<JsonSchemaValidationResult> {
    const report = await validate(jsonSchemaIdentifier, value, BASIC);
    const flattenedErrors = report.errors ? flattenErrors(report.errors) : null;
    return {
      valid: report.valid,
      errors: flattenedErrors
        ? flattenedErrors.map(error => ({
            ...error,
            schemaFragment: this.resolveSchemaFragment(
              error.absoluteKeywordLocation,
            ),
          }))
        : null,
    };
  }

  private resolveSchemaFragment(
    absoluteKeywordLocation: string | undefined,
  ): unknown | null {
    if (!absoluteKeywordLocation) {
      return null;
    }
    const [schemaId, pointer = ""] = absoluteKeywordLocation.split("#");
    const schema = this.schemaStore.get(schemaId);
    if (!schema) {
      return null;
    }
    if (pointer === "" || pointer === undefined) {
      return schema;
    }
    return getValueAtPointer(schema, pointer);
  }
}

function flattenErrors(errors: OutputUnit[]): OutputUnit[] {
  const flattened: OutputUnit[] = [];
  for (const error of errors) {
    flattened.push(error);
    if (error.errors) {
      flattened.push(...flattenErrors(error.errors));
    }
  }
  return flattened;
}

function patchJsonSchemaPattern(schemaObject: any): any {
  if (typeof schemaObject !== "object") {
    return schemaObject;
  }
  for (const [key, value] of Object.entries(schemaObject)) {
    if (key === "pattern") {
      schemaObject[key] = sanitizePattern(String(value));
    } else {
      patchJsonSchemaPattern(value);
    }
  }
  return schemaObject;
}

function getValueAtPointer(schema: any, pointer: string): unknown | null {
  const tokens = pointer
    .split("/")
    .filter((token, index) => !(index === 0 && token === ""));
  let current: any = schema;
  for (const rawToken of tokens) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !(token in current)
    ) {
      return null;
    }
    current = current[token];
  }
  return current;
}

function sanitizePattern(value: string): string {
  // Loading from JSON directly does not work for values as "^mailto\\:".
  return value.replace(/\\:/g, ":");
}
