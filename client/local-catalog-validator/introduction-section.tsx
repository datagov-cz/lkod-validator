import React from "react";
import Box from "@mui/material/Box";
import { Trans } from "react-i18next";

/**
 * This section provide user with information and instruction about using this application.
 */
export function IntroductionSection() {
  return (
    <Box sx={{ mb: "1rem" }}>
      <Trans i18nKey="ui.introduction">
        Dummy text node here to make i18n work, it should not be visible to a
        user ...
        <a
          href="https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/"
          target="_blank"
          rel="noopener noreferrer"
        >
          OFN
        </a>
        <a
          href="https://data.gov.cz/lokální-katalogy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Local Data Catalogs
        </a>
        <a
          href="https://data.gov.cz/špatná-praxe/technické-překážky/#chybějící-podpora-cross-origin-resource-sharing-cors"
          target="_blank"
          rel="noopener noreferrer"
        >
          CORS
        </a>
      </Trans>
    </Box>
  );
}
