# Demo video storyboard (target 2:45, record Nov 3)

Judging weights: Impact 30, Meta tooling 25, Demo 25, Depth 20. Every scene names the Meta model on screen.

| t | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00 | Hook | Slide: "Carriers of one DPYD variant are 4% of chemo patients and 48% of the deaths." (PMID source small) | Fluoropyrimidines are the backbone of colon, stomach and breast chemo. A gene test exists. In India nobody reads it right. |
| 0:15 | The real input | Phone photo of a lab PDF: rsIDs, star alleles, "HapB3 heterozygous" | This is what lands on an oncologist's desk in Kochi. No pharmacogenomics training, 40 patients today. |
| 0:30 | Ingest | Pathya home, drop the phone photo (not the PDF), "Muse Spark reads the report" badge, six gene calls appear with verbatim quotes | Muse Spark reads the photo and quotes every call verbatim. PharmCAT, CPIC's own engine, assigns phenotypes. No dose comes from the LLM. |
| 0:55 | India lens | Amber card: c.85T>C ~25% of Indians, CPIC says normal, South Indian cohorts say toxicity | CPIC's panel was built on Europeans. We layer Indian evidence as rules, each with its PMID. |
| 1:10 | Dictation | Click mic, speak Malayalam+English: "Xeloda തുടങ്ങാം, irinotecan കൂടെ…" transcript appears with speaker A/B | Muse Voice Transcribe handles code-switched Malayalam, keyword-biased to drug names. Meds auto-fill. |
| 1:35 | Report | Clinician summary, AVOID/ADJUST badges, PMIDs | Capecitabine: reduce 50%, CPIC Strong, PMID on screen. Irinotecan: DPWG. Clopidogrel: avoid. |
| 1:55 | Patient | Malayalam panel scroll | The patient gets the same answer in Malayalam, written for them, not for a journal. |
| 2:10 | Latest check | "Check labels" button, Oct 3 2025 Xeloda boxed warning with citation | Muse Spark web search confirms the FDA boxed warning from last October. |
| 2:20 | Confirm | Clinician review radios, confirm, audit log line | Nothing is advice until the oncologist confirms. Every step is logged. |
| 2:30 | Proof | Oncologist quote card; eval terminal 4/4 PASS on hosted Spark and on open-weights Spark Open; docker run one-liner | Two Kochi oncologists ran their own past cases. Deterministic eval, same answers from open weights a hospital can self-host. One container. No SAM, no Muse Image: nothing to segment, nothing to draw. |
| 2:40 | Close | Pathya logo, "the regimen that suits this patient", repo URL | Pathya. Right drug, right dose, this patient's genes, in their language. |

Recording notes: 1440p screen capture, zoom to 125%, pre-run the lab sample so Spark latency (~30 s) is cut; show real timing once with a timer overlay for honesty. Subtitles for Malayalam segments.
