# Pathya — Meta Global AI Developer Hackathon plan

**Deadline:** Nov 4 2026, 9:00 PM ET (= Nov 5, 07:30 IST). Submit via Cerebral Valley portal: working demo + demo video.
**Track:** Startup (as applied). **Theme:** Build for Your World (oncology pharmacogenomics, Kochi).
**Application promise:** AI assistant reasoning over pharmacogenomic data, explaining variants, flagging medication risk, starting with cancer treatment. Submission must visibly deliver exactly that.

## One-liner
Upload a patient's genotype (VCF) + their medication list → CPIC-grounded toxicity risk report for the oncologist, plus a plain-language explanation for the patient in English and Malayalam. Deterministic genotype calling (PharmCAT), Muse Spark for reasoning/explanation with citations, Muse Voice Transcribe for dictated consults.

## Rubric → what we build
| Criterion (weight) | How we score it |
|---|---|
| Impact 30% | DPYD/TPMT/UGT1A1/NUDT15 toxicity is fatal and preventable. Real oncologist pilot (2 clinicians, 5 anonymised cases) quoted in video. India has near-zero pre-treatment PGx testing; cost of test is falling, interpretation is the bottleneck. |
| Meta tooling 25% | `muse-spark-1.3`: PDF/report ingestion, structured output, tool calling (CPIC API, PubMed), web_search grounding with url_citation. `muse-voice-transcribe-1.0`: dictated consult → med list (diarized). Show both in demo, name them on screen. |
| Demo 25% | 3-minute video: upload VCF → gene cards light up → drug list flags "AVOID capecitabine (DPYD PM, CPIC Strong)" with citation → patient explanation in Malayalam → dictate consult, meds auto-extracted and re-checked. Deployed URL judges can click. |
| Technical depth 20% | PharmCAT pipeline in-process (docker/jar), normalised PGx model, agentic retrieval loop with CPIC PostgREST tools, strict JSON schemas, eval suite on known CPIC cases (synthetic VCFs with DPYD *2A, TPMT *3A, CYP2C19 *2, UGT1A1 *28, NUDT15 *3). Audit log per analysis. |
| Startup lens: "holds up in production" | Deployed, auth, rate limits, PHI not sent to third parties except Meta API, clinician-confirm gate, tests, error states, observability. |

## Architecture (minimal)
- Next.js 16 app (this repo). Node runtime routes.
- `src/lib/pharmcat.ts`: run PharmCAT (`docker run pgkb/pharmcat pharmcat_pipeline` or `java -jar`), parse `*.report.json` → `PgxProfile { genes[], drugs[] }`.
- `src/lib/meta.ts`: OpenAI SDK client, baseURL api.meta.ai/v1. Helpers: `structured()`, `withTools()`, `transcribe()`.
- `src/lib/cpic.ts`: fetch wrappers over api.cpicpgx.org/v1 (pair_view, recommendation_view, test_alert_view) exposed as tools.
- `src/app/api/analyze`: POST vcf + meds → profile (PharmCAT) → Spark structured report (clinician + patient) → persist JSON under DATA_DIR → return id.
- `src/app/api/transcribe`: POST audio → Muse Voice → Spark extracts meds (structured) → returns med list.
- UI: `/` upload + meds; `/report/[id]` gene grid, drug risk table with CPIC badge + citations, patient tab (EN/ML), "Ask" chat grounded on the report.
- Storage: filesystem JSON under DATA_DIR for hackathon (ponytail: swap for Postgres when multi-tenant).

## Status (updated 2026-10-27 03:00 IST)

- Baseten credits ($100, 2M TPM) for Muse Spark Open wired as second provider in `src/lib/meta.ts`: `structured()` tries `MUSE_PROVIDER` first, other on failure. Open model does not enforce json_schema, so schema goes in the prompt and JSON is extracted from text. No responses API there, so PDF extraction and web search stay on api.meta.ai. Smoke: `pnpm tsx --env-file=.env scripts/smoke-baseten.mts` (needs `BASETEN_API_KEY`). Smoke passed (chat, prompt-guided JSON, PNG image input). Eval 3/3 with `MUSE_PROVIDER=baseten`, 73 s total, no fallback. Pitch line: open weights = self-hostable inside the hospital.
- DONE: Meta key verified from India (Spark chat/JSON/PDF/web_search; Voice ML+EN diarized). VCF path, lab-PDF path, India lens, Muse report EN+ML, voice consult + recorder, confirm gate + audit, latest-guidance web search, access code, Dockerfile on pgkb/pharmcat, README, EVIDENCE.md, eval 3/3.
- Deployed 2026-10-27: https://16.4.131.103.sslip.io (EC2, docs/DEPLOY.md). Login, PDF, phone photo, voice, mic all verified on prod. Phone-photo fixture added as 4th eval case and home-page sample.
- NEXT, in priority order: (1) oncologist pilot booked and run (LAB-CALLS.md, the Impact differentiator); (2) lab calls; (3) demo video per DEMO.md with the phone photo as the input; (4) submission text; (5) report-page polish pass.

## Field scan (Discord intros, 2026-10-27)

Read ~70 builder intros. No oncologist, clinician, pharmacist, or PGx/genomics project in the channel. Nearest: Jason/Qingyuan Zhang (NJ, clinical-trial data platform), VerbaGPT (US insurance ranking), Aritra (SafeCity Lens: evidence score + human approval for police/fire/hospital). Pathya is alone in clinical decision support.

Patterns that change what we emphasise:
- Multi-model stacking is the norm: SAM 3.1 + Spark + Voice + Glimmer in several India "Build for Your World" entries (Smeet Mehta FieldWitness crop-damage claims, Sumer, devDonald crop copilot). Tooling score risk. Answer: phone photo through Spark vision on screen (not just PDF); say on camera why SAM/Image are not used; open-weights Spark Open as the self-host path.
- "Human approves before action" is table stakes (Ankita, Sho, Aritra). Confirm gate alone does not differentiate. Lead with PharmCAT determinism, cited India lens, code-switched Malayalam voice, open weights for data residency.
- Every credible pitch names a real user (brother's dealership, drinks distributor, farmers). Our equivalent is the two-oncologist pilot with quotes. Without it Pathya is one more demo.
- Nearly everyone is Indie. Startup track looks thin; production proof (deployed URL, eval, one container, audit log) is the edge over Indie polish.

## Day plan (IST)
- Oct 27: Meta key + smoke test all 3 endpoints. PharmCAT lib + parser + synthetic risky VCF fixtures. `/api/analyze` returns deterministic profile. Commit.
- Oct 28: Spark report generation (strict schema), CPIC tools, citations. Report page UI.
- Oct 29: Patient explanation EN+ML, PDF report ingestion path (lab PGx PDF → Spark extracts diplotypes → outside-calls TSV → PharmCAT), ask-chat.
- Oct 30: Voice consult: record → transcribe → meds → re-check. Audit log, auth (simple), rate limiting.
- Oct 31: Eval suite (known CPIC cases), error states, polish UI, deploy (Vercel + PharmCAT jar; or Fly/Modal for docker). Decide on hosting PharmCAT (jar on Node runtime needs java → use Modal credits or small VM).
- Nov 1–2: Clinician pilot runs, collect quotes, fix findings.
- Nov 3: Demo video, README, landing copy, submission draft.
- Nov 4: Submit by 9 PM ET. Buffer.

## Risks
- Meta API access from India for Spark/Voice unknown until key tested. Fallback: none acceptable (tooling 25%). Test day 1.
- PharmCAT needs Java; Vercel functions can't run it. Host PharmCAT as tiny service (Modal credits) or run whole app on a VM. Decide Oct 31.
- Medical liability optics: every recommendation carries CPIC citation + classification; clinician-confirm gate; "decision support, not advice" banner.
- CYP2D6/HLA need outside calls (not callable from VCF by PharmCAT). Accept via manual/PDF-extracted outside calls.
