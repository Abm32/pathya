# Demo video storyboard (target 2:55, record Nov 3)

Judging weights: Impact 30, Meta tooling 25, Demo 25, Depth 20. Every scene names the Meta model on screen. The story runs the way the product does: before the test, then after it.

| t | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00 | Hook | Slide: "Carriers of one DPYD variant are 4% of chemo patients and 48% of the deaths." (source small) | Capecitabine and 5-FU are the backbone of colon, stomach and breast chemotherapy. A gene test prevents most of the deaths. In India it is almost never ordered in time, and almost never read. |
| 0:15 | Day 0: no test yet | Home, "No test yet? Check a regimen". Type "Xeloda 1000 mg/m² BD, Emeset 8, Pan 40". DPYD card appears: "Order before cycle 1", ₹7,000–17,000, 7–10 days | At diagnosis the oncologist types the regimen as it is written on the chart. Pathya says: order DPYD today, because the result takes 7 to 10 days. Instant, deterministic, free. |
| 0:35 | Lymphoma chip | Click "Lymphoma, high TLS risk": G6PD before rasburicase | It knows India: G6PD deficiency in about 8.5% of Indians, before rasburicase. |
| 0:42 | Messy input | "Brands the table lacks" chip, then "Name these drugs": Muse Spark names capcitabin and Rabicip, the badge says so, DPYD appears; click "Print the test request" | Charts are messy. Muse Spark names the drug, and only names it; the guideline table still decides the test. One click gives the lab a request, and the patient a Malayalam explanation. |
| 1:00 | Day 8: the result | The WhatsApp photo full screen (skewed, noisy), then "Run it on a phone photo"; the live pipeline lights step by step, timer visible | The result comes back as a photo on WhatsApp. Muse Spark reads it and quotes every gene call verbatim. PharmCAT, CPIC's own engine, calls the phenotype. No dose comes from the language model. |
| 1:20 | Report, at a glance | One line per drug: capecitabine ADJUST "halve the starting dose" | Capecitabine: start at 50%, CPIC text, cited. Pantoprazole and ondansetron: standard. |
| 1:32 | India lens | Amber card: c.85T>C ~25% of Indians, CPIC says normal, South Indian cohorts say toxicity | CPIC was built on European data. We add the Indian evidence as rules, each with its PMID. |
| 1:45 | Dictation | Mic, Malayalam + English: "Xeloda തുടങ്ങാം, Emeset കൂടെ…"; transcript with speakers, meds fill in | Muse Voice takes the consult as it is spoken, Malayalam and English mixed, biased to drug names. |
| 2:00 | Patient | Malayalam tab | The patient gets the same answer in Malayalam, written for them. |
| 2:08 | Confirm | Review chips, confirm, audit line | Nothing is advice until the oncologist confirms. Every step is logged. |
| 2:18 | Proof | Scroll to chapter 05: harsh-photo bars fill to 100% while OCR stays at 0; 26/26 vs 2/20 | On 36 held-out reports, including skewed, shadowed photos, Muse Spark and open-weights Spark Open read all 177 gene calls; OCR read none of the harsh ones. The open model means a hospital can keep genomic data in-house. |
| 2:38 | Pilot | Oncologist quote card (only if real) | [PILOT quote, or cut this scene] |
| 2:46 | Close | Pathya logo, "Chemo toxicity, caught before cycle one.", live URL | Pathya. The right test at diagnosis, the right dose at cycle one, in the patient's language. |

Recording notes:
- Capture at 1440p and zoom to 125%.
- Pre-run one case so you can cut the wait, then show the real timer once for honesty (about 45 s).
- Add subtitles for the Malayalam segments.
- Keep the access code off screen. Use the public `/sample` report for the report scenes if you are not signed in.
