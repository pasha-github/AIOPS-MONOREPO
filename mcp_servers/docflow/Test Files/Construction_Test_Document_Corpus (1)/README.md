# Construction Document Search Agent — Test Corpus

47 documents simulating a multi-source repository (SharePoint / OneDrive / File Server)
for 30 vendor/project pairs — 14 in KSA, 16 international — used to test a document
search agent for a Saudi construction client.

## Folder structure
```
SharePoint/    Contracts, RFIs, Submittals, Financial, Drawings
OneDrive/      ProjectShares, PersonalDrives
FileServer/    Drawings, Permits_Inspections, Reports, Archive
```
`Document_Manifest.csv` is the ground-truth index (project, vendor, country, doc type,
language, source, and which test prompt each file supports) — use it to score retrieval
accuracy and check for false positives/negatives.

## Answer key for your 10 test prompts

1. **NEOM villa structural drawings** → Correct answer: **Rev C**, dated 14-May-2026.
   Present in both `FileServer/Drawings/...RevC.pdf` (English) and
   `SharePoint/Drawings/سجل_مراجعة...RevC.pdf` (Arabic-titled, same content).
   Trap: `FileServer/Archive/...RevB_SUPERSEDED.pdf` — a good agent should either exclude
   it or clearly flag it as superseded, not present it as "most recent."

2. **Al-Faisaliah MEP RFIs** → `SharePoint/RFIs/Al-Faisaliah_MEP_RFI_Log.docx`. Correct
   answer: **6 open** (5 overdue), 2 closed. Includes 2 Arabic-language RFI entries mixed
   into the same log.

3. **Jeddah MOMRA permit** → `FileServer/Permits_Inspections/MOMRA_Building_Permit_Jeddah_Corniche.pdf`.
   Correct answer: **EXPIRED** on 18-Jun-2025. A correct agent must flag this proactively.

4. **Riyadh Heights variation order log** → `SharePoint/Financial/Riyadh_Heights_Variation_Order_Log.xlsx`.
   Correct answer: total approved cost impact **SAR 10,450,000** across 13 approved VOs
   (1 pending, VO-013, excluded from the approved total).

5. **Curtain wall submittal** → Two files exist by design:
   `SharePoint/Submittals/..._Transmittal_...docx` (approval-only cover doc — should NOT
   satisfy the request) and `FileServer/Reports/Schuco_FW60_Curtain_Wall_Manufacturer_Spec_Sheet.pdf`
   (the actual manufacturer spec — correct answer). Tests whether the agent distinguishes
   an approval email from the real technical spec.

6. **Civil Defense inspection, last month, Riyadh Heights** → Only report on file is
   `FileServer/Permits_Inspections/Civil_Defense_Fire_Safety_Inspection_Riyadh_Heights_Mar2026.pdf`,
   dated March 2026 — **no report exists for the most recent month**. Correct behavior is
   to say so clearly rather than presenting the March report as current.

7. **Saudi vendor payment terms, bilingual** → Best fit is Al-Faisaliah MEP Systems LLC:
   `SharePoint/Contracts/Subcontractor_Agreement_04...docx` (EN) and
   `اتفاقية_مقاول_من_الباطن_04..._AR.docx` (AR, full bilingual pair). Al-Rashid (Riyadh
   Heights) and Bin Dasmal (Jeddah) also have EN/AR pairs if you want to vary the test.

8. **Tower B punch list, Hijri + Gregorian** → `OneDrive/ProjectShares/Riyadh_Tower_B_Punch_List.docx`.
   Correct answer: **8 open, 3 closed** (11 total), issue date 20-Jun-2026 Gregorian.

9. **Geotechnical soil report, ambiguous name** → Deliberately hard to find:
   `OneDrive/PersonalDrives/site_investigation_final_v2_KM.pdf` (generic English filename,
   personal drive) and `FileServer/Reports/تقرير_فحص_التربة_مشروع_مترو_الرياض.pdf`
   (Arabic filename, different location). Tests broad/fuzzy search across sources and
   scripts.

10. **BOQ original vs. variation-adjusted, cost slippage** →
    `SharePoint/Financial/Dammam_Logistics_Park_BOQ_Original.xlsx` vs.
    `..._BOQ_Variation_Adjusted.xlsx`. Correct answer: **slippage = variation-adjusted
    total minus original total** (adjusted file shows the slippage pre-computed in a
    labeled cell, plus highlighted changed/new line items for transparency).

## Notes
- Currency is SAR throughout KSA documents, USD for international ones, per your
  dashboard convention.
- Distractor/noise projects (16 international ones) exist to test whether the agent
  correctly scopes "KSA" or project-specific queries and doesn't surface irrelevant
  vendors.
- All entities, projects, and figures are fictional test data.
