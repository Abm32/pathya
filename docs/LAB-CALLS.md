# Lab verification calls (do before Nov 3)

Goal: replace the UNVERIFIED items in EVIDENCE.md §3 with first-hand numbers, and collect one real (anonymised) report PDF per lab to test ingestion.

## Labs to call
| Lab | Why | Contact route |
|---|---|---|
| MedGenome (Bengaluru, Kochi collection) | Largest Indian clinical genomics lab | website enquiry form / sales line |
| Strand Life Sciences | Oncology panels, Bengaluru | sales |
| Neuberg Diagnostics (Kochi/Chennai) | Pan-India network, Kerala presence | local Kochi centre |
| 4baseCare | Oncology-focused NGS | sales |
| Lilac Insights | PGx panels | sales |
| DNA Labs India | Lists UGT1A1 TA-repeat at ₹7,500 / 7 days online | phone |
| Regional Cancer Centre Thiruvananthapuram (lab) | Government oncology reference | pathology dept |
| Amrita / Aster Medcity / Lakeshore / Rajagiri (Kochi hospital labs) | Where the pilot oncologists practise | oncology day-care pharmacist |

## Script (5 minutes)
1. "Do you offer DPYD genotyping before 5-FU/capecitabine? Which variants exactly?" (listen for: *2A, *13, c.2846A>T, HapB3/c.1236G>A, c.85T>C, or full-gene sequencing)
2. "UGT1A1 *28 and *6? TPMT and NUDT15 together?"
3. "Price to patient, in INR, and turnaround in working days?"
4. "What does the report look like: star alleles, rsIDs, phenotype, dose recommendation? Can you email a sample/anonymised PDF?"
5. "Who orders it most: medical oncologists, clinical pharmacologists, hospital pharmacy?"
6. "How are results delivered: PDF by email/WhatsApp, portal, HL7/EMR?"

## Record here
| Lab | DPYD variants | UGT1A1 | TPMT/NUDT15 | Price ₹ | TAT days | Report format | Sample PDF received |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Oncologist pilot (2 clinicians, 5 cases each)
Ask: run 5 anonymised past patients (they already know the outcomes), score each report 1–5 on "would this have changed what I did", collect one sentence quote on the Malayalam patient text. Record permission to use the quote in the demo video.

### Outreach message (WhatsApp/email, oncologist)

> Dr ___, Abhimanyu from Anukriti AI (Kochi). We built Pathya: upload a DPYD/UGT1A1/TPMT-NUDT15 lab report (PDF or phone photo), get a CPIC/DPWG-grounded toxicity check for capecitabine, 5-FU, irinotecan, thiopurines, tamoxifen, plus a patient explanation in Malayalam. Genotype calling is PharmCAT (CPIC's engine); the model only maps, ranks and explains, and every PMID is from the guideline profile. Could you run 4-5 anonymised past cases (no names, no IDs) and score each 1-5 on "would this have changed what I did"? 20 minutes, link + access code, we are on a call while you do it. One sentence from you on the Malayalam text would go in our 3-minute hackathon video (deadline 4 Nov), only with your permission. Demo: https://16.4.131.103.sslip.io

### Discord DM (Jason / Qingyuan Zhang, clinical data analytics)

> Hi Jason, Abhimanyu here (Pathya, oncology pharmacogenomics decision support, Startup track). You are the only person in the intros with clinical data background. Would you spend 10 minutes on our report page and tell me what a clinical data reviewer would reject? Deterministic PharmCAT calls, CPIC/DPWG text verbatim, LLM only ranks and explains. Happy to return the favour on your trial-workflow platform.
