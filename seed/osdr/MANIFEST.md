# seed/osdr — MANIFEST

Downloaded 2026-11-14T13:26:02.142Z by `scripts/fetch-data.ts` (`npm run fetch:data`).
File list from the OSDR API `https://osdr.nasa.gov/osdr/data/osd/files/<n>` (`studies["OSD-<n>"].study_files[]`,
`remote_url` relative to `https://osdr.nasa.gov`). The long-format `*.upload_SUBMITTED.csv` file was chosen because it
carries the reference-range columns (`RANGE_MIN`, `RANGE_MAX`) together with `SEX` and the time point on every row.

| Study | Original file name | Saved as | Bytes | SHA-256 |
|-------|--------------------|----------|-------|---------|
| OSD-569 | `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` | `seed/osdr/OSD-569_CBC.csv` | 26138 | `10a878b009eb2ea11a13fe92ad698098858639e8ed02f5ee849431313b9457d3` |
| OSD-575 | `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` | `seed/osdr/OSD-575_CMP.csv` | 25275 | `dab247eb794edab59aaaa683c85fd1f2dbf4ae3684872739338e10ead4192a0c` |

Derived: `seed/osdr/preflight-anchors.json` (pre-flight time points L-92, L-44, L-3 only).

## Credits

- NASA Open Science Data Repository (OSDR), OSD-569 "Inspiration4 complete blood count" and OSD-575 "Inspiration4
  metabolic and cytokine panels" — https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 and
  https://osdr.nasa.gov/bio/repo/data/studies/OSD-575. Open NASA data; anonymised commercial crew subjects C001–C004.
- ARGUS uses only the pre-flight values, as anchors for four fictional crew members; the mapping implies nothing about
  the real crew.
