import { ValidationReporter } from "../validator-api";

export type ContentTypeHeader = {
  type: string;
  parameters: Record<string, string>;
};

const GROUP = "http.group";

/**
 * Start a fetch request and return response object.
 */
export async function initiateResourceFetch(
  url: string,
  report: ValidationReporter
): Promise<Response | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    report.critical(GROUP, "http.fetch-failed", { url: url });
    console.error("Can not fetch data.", error);
    return null;
  }
  if (!response.ok) {
    // Status is not in the range 200-299.
    report.critical(GROUP, "http.invalid-response", { code: response.status });
    return null;
  } else {
    report.info(GROUP, "http.success");
    return response;
  }
}
