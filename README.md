# Validátor lokálních katalogů otevřených dat (LKODů)

Tento repozitář obsahuje validátor lokálních katalogů otevřených dat na základě otevřené formální normy [Rozhraní katalogů otevřených dat: DCAT-AP-CZ](https://ofn.gov.cz/dcat-ap-cz-rozhraní-katalogů-otevřených-dat/2024-05-28/), tj. dle rozhraní DCAT-AP Dokumenty a DCAT-AP SPARQL Endpoint.
Pro správnou funkci LKOD je třeba, aby jeho přístupový bod LKOD implementoval [techniku CORS](https://data.gov.cz/špatná-praxe/technické-překážky/#chybějící-podpora-cross-origin-resource-sharing-cors).

Validátor běží plně ve vašem prohlížeči.
[Přejít na validátor](https://datagov-cz.github.io/lkod-validator/).
Alternativně je možné validátor [spustit lokálně mimo prohlížeč](#lokalni-instalace-a-spustrni).

Na validátor se dá odkázat i s URL přístupového bodu v parametru `catalog`, např. [`https://datagov-cz.github.io/lkod-validator/#catalog=https://data.dia.gov.cz/sparql`](https://datagov-cz.github.io/lkod-validator/?catalog=https://data.dia.gov.cz/sparql), což přímo spustí validaci.

## Lokální instalace a spuštění

Narozdíl od běhu v prohlížeči lokální běh nemá problém přečíst katalogy, které nemají správně nastavenou techniku CORS.
Výsledek validate lokálního běhu a běhu v prohlížeči se tak může lišit!

## Požadavky

Pro instalaci je třeba mít k dispozici:

- [Node.js](https://nodejs.org/en) verze 20 nebo novější

## Instalace

Nejprve je třeba provést stažení tohoto repositáře a instalaci závislostí.

```bash
git clone https://github.com/datagov-cz/lkod-validator.git
cd lkod-validator
npm ci
```

Následně je možné validaci pustit pomocí následujícího příkazu.

```bash
npm run --silent validate https://raw.githubusercontent.com/jakubklimek/lkod-test/main/katalog.jsonld
```

Program následně vypíše výsledek validace ve formátu JSON na standartní výstup.
