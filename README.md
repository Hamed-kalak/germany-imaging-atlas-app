# Germany Imaging Atlas — inpatient CT and MRI in Germany

Online: https://w3id.org/germany-imaging-atlas/

**Inpatient CT and MRI utilisation across 624 ICD-10-GM diagnoses in Germany, 2005–2024.**

An interactive atlas of two decades of the German DRG statistics — a mandatory
annual census of every inpatient hospital case. For each diagnosis it shows how
often imaging happened, how that changed, how much imaging an imaged admission
received, and the age and comorbidity of each imaging group.

Companion to the Article *"Inpatient CT and MRI utilisation across 624 diagnoses
in Germany, 2005–24: a national atlas."*

## For server administrators

This repository is the deployable dashboard: one nginx container serving static
files. No database, no backend, no external APIs, no outbound network, no
cookies, nothing written to disk.

```bash
docker compose up -d --build      # builds and starts it on port 8501
curl -s http://127.0.0.1:8501/healthz                       # -> ok
curl -s http://127.0.0.1:8501/build.json                    # data hash and the checks it passed
```

- Serve it at the **root** of a host name (for example `https://atlas.example.org/`),
  not under a sub-path, behind your reverse proxy, which handles TLS.
- The data is already checked and stamped (`public/build.json`), so `npm run
  stamp` and `npm run check` are not needed here (they need the authors'
  research repository).
- Full guide: [DEPLOY.md](DEPLOY.md), starting at section 1. Section 2 only
  applies to the department VM that ran the earlier dashboard.
- Updates: `git pull && docker compose up -d --build`.

## What it shows

- **20 ICD-10-GM chapters** and all **624 diagnoses**, as a treemap you drill into.
  Tile size and order follow whichever metric is selected, and tiles *move* to
  their new places when you switch CT/MRI or Rate/Volume, so a diagnosis can be
  followed across the change.
- per **diagnosis and per chapter**: the utilisation trend, the none / single /
  multiple split, rates for men and women separately, and mean age, Elixhauser
  count and van Walraven score by imaging group. A chapter is its codes pooled —
  counts summed, stratum means weighted by their own counts, rates recomputed
  from the pooled counts — and is shown by the same panel a diagnosis is.
- **Building a pool**: the **Pool** button holds a search across all 624
  diagnoses (by code or by name, regardless of chapter), what you have picked as
  removable chips, and *add all of this chapter*. ⌘/Ctrl-click also works — on a
  diagnosis tile to toggle one, on a chapter tile to take all of it. **Clear**
  sits beside the Pool button and empties it where you stand; **Back** empties it
  and returns to all chapters. The pool is kept while you move between chapters,
  and **while it is on screen the treemap becomes the pool**: its own tiles, each
  in its chapter's colour, however many chapters it spans. A picked diagnosis the
  cohort filters exclude is kept but not drawn — the button then reads *Pool ·
  N of M*, and the popover says how many are waiting on a looser filter.
- The treemap is sized and ordered by utilisation rate or case volume, with
  the multiple-code fraction, coded imaging intensity (multiple-to-single), and the mean age, Elixhauser count and
  van Walraven score **of the imaged** behind **More**. Those last three read the
  single and multiple groups only: pool the not-imaged group back in and CT and
  MRI describe the same admissions, so the two come out identical to the decimal
  and the modality toggle moves nothing. Over the imaged alone they are different
  populations — CT-imaged admissions run 6–12 years older than MRI-imaged ones.
- **Adding from the pool popover shows the pool straight away** — search
  "ischaemia", add the matches, and the treemap is those codes, with the
  breadcrumb reading *Your pool (N)*. ⌘/Ctrl-selecting tiles does not: that is
  browsing, and collapsing the chapter you are picking from would take the other
  tiles away mid-selection. **Show these N** in the popover is how a ⌘-clicked
  pool is put on screen.
- **Hovering a diagnosis links the three charts**: hover its name, its heatmap
  row or its rank, and the line, the row and the rank all pick out together,
  with the ranking scrolling to it if it is off screen.
- **A pool is named by its codes, never by a range.** Picking R56 and R93 is
  chipped *Your pool* and titled `R56 · R93`, with the chapter underneath; it
  used to be chipped `R00–R99`, which is the whole of chapter XVIII. A code range
  appears only where the subject really is that range — a chapter you opened.
- **One panel, one layout, whatever you are looking at** — a single diagnosis, a
  pool, or a whole chapter. The **Pooled / Compare** switch sits on the page
  background above the card and never moves; under it comes the subject — its
  code or code range, its name, the modality beside it, its chapter — and then
  the measure. A
  single diagnosis used to be a different component with no mode switch at all,
  and choosing Compare used to grow the header and shove every chart down.
- A **set** of diagnoses — a chapter you opened, or a selection you assembled —
  is always shown by the same panel, in one of two modes:
  - **Pooled** — the set summed into one record and rendered by the panel a
    single diagnosis uses, so a chapter shows exactly what a diagnosis shows.
    CT and MRI stand side by side here by definition, so the modality control
    keeps its place but is locked to **Both**; Compare is where it is chosen.
  - **Compare** — how its members differ: pick one measure (utilisation rate,
    the multiple-code fraction, coded imaging intensity (multiple-to-single), imaged admissions, and the mean age,
    Elixhauser count and van Walraven score of the imaged) and it drives all
    three views at once — a line per code, a ranking by change per year, and a
    code × year heatmap carrying each diagnosis's full rubric. The lines have no
    tooltip: the ranking and the named heatmap rows say which line is which
    without a box over the very lines being compared.
    **Both** draws each modality in its own colour, with two heatmap rows per
    diagnosis, and halves how many codes the line overlay carries so the plot
    holds the same number of lines either way. The two are never added together: they
    are separate tabulations of the same admissions, so an admission with both
    would be counted twice and a combined rate is not derivable. Pooled shows
    CT and MRI side by side already, so it has no modality toggle.

  Opening a chapter starts on Pooled; assembling a selection starts on Compare.
  Nothing else differs between the two routes.

Every number is one the Article reports, computed in the browser from the
aggregated tables the Research Data Centre returned. `npm run check` asserts
that all 624 codes match the Article's appendix table S1 exactly — chapter,
rates, sex-stratified rates, case totals and released-year counts — and that the
headline figures reproduce.

## What is deliberately not here

No models and no analysis of the **difference** between men and women. Rates are
reported for each sex separately, as the SAGER guidelines require, and nothing is
derived from the difference between them: these data — one mean per year × code ×
sex cell — cannot support it.

## Reading the numbers

- The unit is the **hospital case** (*Behandlungsfall*), not the person. Someone
  admitted twice contributes two records, and the data carry no identifier
  linking admissions.
- "Imaging" counts **OPS procedure codes**, not examinations: CT from groups
  3-20 (native) and 3-22 (contrast-enhanced), MRI from 3-80 and 3-82. OPS codes
  are region-specific, so one acquisition covering several regions can contribute
  more than one code. **Multiple** therefore counts procedure codes within one
  admission — the Article's procedure-code intensity — and is an upper bound on
  separate examinations.
- **Disclosure control:** a year × code × sex cell is present for a modality only
  where at least 100 cases in it had a qualifying procedure code. Suppressed
  cells are absent, never counted as zero, so a diagnosis may show fewer than
  twenty years.
- Administrative data carry no indication and no outcome, so **nothing here says
  whether any imaging was warranted**.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # all three gates: parity, integrity, render
npm run stamp    # the gates, then public/build.json — required before a docker build
npm run build    # -> dist/, any static host will serve it
```

No server, no database, no API: `dist/` is a static bundle plus one JSON.

### The three gates

| gate | what it proves |
|---|---|
| `check-paper1-parity.mjs` | all 624 codes and 20 chapters against appendix table S1, nine headline numbers, and that nothing outside the Article reached the source or the bundle (kept in the repository; not part of the deposit) |
| `check-integrity.mjs` | seven printed claims — value recomputed **and** the literal still on screen — plus twelve data invariants, table S0, all 624 rubrics, and a sweep over 3,614 suppressed cells |
| `check-render.mjs` | every panel actually renders, at 1 / 51 / 624 diagnoses: no crash, no `NaN` or `undefined` in the output, and each inside a time budget |

`npm run stamp` runs all three and writes `public/build.json` — the data's
SHA-256, the row count, the commit, the verdicts — only if every one passes.
The Docker build re-hashes the data and refuses to build if it does not match
the stamp, which is how the gates' verdict reaches an image that cannot see
`research/`. Deployment is in [DEPLOY.md](DEPLOY.md).

## Data

Aggregated, disclosure-controlled tables from the German DRG statistics
(*Fallpauschalenbezogene Krankenhausstatistik*), returned by the Research Data
Centre (Forschungsdatenzentrum) of the Federal Statistical Office and the
statistical offices of the Länder under project 4509-2021. The analysis ran by
controlled remote data processing: extraction code written by the study team was
executed by Research Data Centre staff, who applied statutory anonymisation and
disclosure control and returned only aggregated tables. No author had access to
individual-level records, and the underlying microdata cannot be redistributed —
qualified researchers may apply to the Research Data Centre under its standard
terms.

**Required source line for any reuse:**

> Source: RDC of the Federal Statistical Office and Statistical Offices of the Federal States,
> DOI: 10.21242/23141.2005.00.00.1.1.0 to 10.21242/23141.2024.00.00.1.1.0, own calculations.

## Cite

> Mirbagheri H, Scheurig-Münkler C, Hellbrück S, Kröncke T, Decker JA.
> Germany Imaging Atlas: inpatient CT and MRI, version 1.0 (extraction v2.8)
> [dashboard]. 2026. https://w3id.org/germany-imaging-atlas/

Please cite the Article for any use of these estimates.

## Build notes

- React + Vite + TypeScript, charts with Recharts, treemap with d3.
- **No third-party requests at runtime.** Inter is bundled rather than loaded
  from Google's CDN: a page served from a German institution should not hand
  every visitor's IP address to a third party, and a published research artefact
  should not stop rendering correctly if that third party changes.
- The data file is ~18 MB of JSON, ~3 MB gzipped, fetched once and held in
  memory. It is generated by `build_atlas_data.py` in the analysis repository
  and contains exactly the 624 included codes.
- Chapter colours are the **Article's figure palette**, ported from
  `research/code/analysis/style.py` in the same chapter order, so a chapter
  keeps its colour between a figure and this page. Five of the twenty-two are
  darkened 13–21% because tile labels are white and those five sat below the
  4.5:1 contrast ratio white needs; each is darkened by the least that clears it.
- The treemap encodes a **higher** utilisation rate as a **deeper** shade of the
  chapter's colour, left to right by year. It runs towards ink rather than white
  so the palest any tile gets is the chapter colour itself, which is legible by
  construction.
- The treemap sizes and orders by whichever metric is selected, so switching
  CT/MRI or Rate/Volume relays the tiles out rather than only changing the
  printed number.
- A tile showing **—** has no released cells for that modality. That is the
  disclosure filter, not zero imaging, and is never counted as zero.
- **A tile's left-to-right ramp stops at every unreleased year**, and a neutral
  hatch shows through. The ramp used to carry the last released shade across the
  gap, seeded at zero, so a diagnosis with one released MRI year out of twenty
  was painted pale for nineteen and dark for one — which reads as a spike in that
  year. Those nineteen years were not low, they were unknown, and a tile filled
  edge to edge claims twenty years of evidence it does not have.
- **Suppressed years are gaps, everywhere.** No line is bridged across one, no
  area is gouged to the axis, no summary averages one in as a zero. A released
  year with suppressed years on both sides is drawn as a single dot rather than
  a zero-length segment, and a modality or a sex with nothing released reads
  "—" rather than "0.0%". Release is decided per year × code × **sex**, so one
  sex can be absent while the other is shown.
- The classification is **ICD-10-GM**, the German Modification — not WHO ICD-10
  and not ICD-10-CM. Its chapter III runs D50–D90 (WHO: D50–D89), its chapter XX
  ends at Y84 (WHO: Y98), and it adds chapter XXII (U00–U99).
- Chapters are resolved from the **code range**, not the first letter: A00–B99
  and S00–T98 are each one chapter, while D and H straddle a boundary. Grouping
  by letter splits two chapters and merges four. See `src/data/chapterMeta.ts`.
- Chapter tiles are labelled by **name**, with the numeral and range beneath —
  "XVIII" is what the classification calls it, not what a reader can use.
