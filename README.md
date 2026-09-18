# MOTION — London transport picture

MOTION is a map-led transport intelligence dashboard for asking a practical question: **where is London losing travel time, and which corridors deserve investigation first?**

The interface brings together three views in one working surface:

- public-transport reliability, compared against scheduled operating exposure;
- road delay pressure, expressed as a corridor delay ratio; and
- associated context such as incidents, roadworks, peak-arrival concentration and headway variance.

The map is intentionally the first screen. Selecting a corridor updates the evidence panel and intervention queue; the analysis tabs expose the comparison logic and data contract.

## Current state

This repository contains a polished, interactive prototype with a **clearly labelled demonstration baseline**. It is not presented as a live TfL feed. The layout is ready for the next ETL pass, where official extracts can populate the same schema and measures.

The main map uses Leaflet with real London street tiles from OpenStreetMap, an Esri World Imagery satellite option and a reference-label layer. The transport, pressure and incident overlays are intentionally analytical: they sit on top of the geographic base so the evidence panel can explain what to investigate. Attribution is shown on the map itself.

## Planned analytical pipeline

```text
TfL Unified API / TIMS + DfT counts + London Datastore
                         ↓
              Python + pandas ingestion
                         ↓
                  SQL model / joins
                         ↓
         R checks, comparisons and diagnostics
                         ↓
        Tableau-ready extracts and dashboard views
```

The first refresh should add `transport_events`, `road_conditions`, `context_events`, `dim_location`, `dim_route` and `dim_time` tables. Reliability and pressure scores should be reproducible from those tables rather than typed into the UI.

## Metric definitions

- **Transit reliability** = `(scheduled minutes − disruption minutes) / scheduled minutes`.
- **Road delay ratio** = observed corridor travel time divided by the free-flow baseline.
- **Intervention score** = a documented ranking of pressure, exposure and evidence coverage. It is a triage aid, not a claim that a single factor caused a delay.

## Official data starting points

- [TfL open data](https://tfl.gov.uk/info-for/open-data-users/our-open-data) — Unified API, line status, arrivals, road disruptions, cycle hire and GIS feeds.
- [DfT Road Traffic Statistics](https://roadtraffic.dft.gov.uk/) — annual average daily flow, count points and historic road counts.
- [London Datastore](https://data.london.gov.uk/) — open datasets published by London government and public bodies.

## Run locally

```bash
pnpm install
pnpm dev
```

For a production check:

```bash
pnpm build
```

The project uses the Vinext starter supplied for Sites and keeps its source under `app/`.

## Tools demonstrated

Python · pandas · SQL · R · Leaflet · Tableau-ready data design · geospatial thinking · data storytelling · responsive React UI
