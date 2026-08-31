---
title: "Studying the Port Domain #4 — Identifiability, and Public Data Is Just a Record"
description: "An IMO number never changes until the ship is scrapped. I went through the code systems for ships, cargo, and equipment, looked at how to get data from PORT-MIS and UNI-PASS, and worked out why public data can't be used for analysis as-is."
pubDatetime: 2026-08-25T07:05:00Z
tags:
  - K-뉴딜아카데미
  - 항만도메인공부
  - 공공데이터
  - 데이터분석
  - 도메인지식
  - 학습
draft: false
featured: false
---

While explaining code systems, the lecture put it this way:

> For someone working with data, a code system is like **a key in a database**. The most important thing in a database is **identifiability**.

[In #2 I saw that an identifier gets issued at every stage](/en/posts/port-domain-02-export-import-process). This time it's about what each of those codes actually identifies.

## Table of contents

## Ship identification codes

- **Ship name**
- **IMO number** — Assigned by the International Maritime Organization when a ship is built. It's like a resident registration number, and **it doesn't change until the ship is scrapped.** Since it's unique worldwide, you can track a ship with just this
- **Call sign** — The identifier a control tower uses to call a ship when it enters port. You can also look ships up by call sign in PORT-MIS. Ships have nationalities too, and the call sign differs by nationality
- **MMSI (Maritime Mobile Service Identity)** — A 9-digit number

> For analysis work, **using the IMO number is best.**

The point is to pick a key that doesn't change. A ship's name can change, and a call sign is tied to nationality.

## Ship specification codes

How big a ship is, what it carries.

- **Gross tonnage**
- **Deadweight tonnage (DWT)** — This is the ship's actual weight
- **Container ship size units** — TEU, FEU
- **Draft** — A heavy ship loaded with a lot of containers displaces more water. **This matters when assigning berths**

Draft determines port facility usage fees, pilotage fees, and ship inspection costs. A single physical measurement directly connects to a fee schedule.

## Cargo and transport codes

**FCL / LCL**

- **FCL (Full Container Load)** — A whole container. **Master B/L**
- **LCL (Less than Container Load)** — Sharing a container with others. **House B/L**

[The consolidated cargo I saw in #2](/en/posts/port-domain-02-export-import-process) is LCL, and that's what connects to why the B/L gets split.

**B/L** — Bill of Lading. Used in export/import operations as a **document of title (a negotiable instrument)**.

**Cargo management numbers — MRN · MSN · HSN**

| Code | Meaning | Structure / Issuance |
|---|---|---|
| MRN (Manifest Reference Number) | Manifest reference number | 2-digit submission year + 4-digit carrier's English code + 4-digit carrier-specific number + 1-digit check digit |
| MSN (Master B/L Sequence Number) | Master B/L sequence number | Entered by the shipping/airline company when preparing the manifest and submitted to customs. 4 digits |
| HSN (House B/L Sequence Number) | House B/L sequence number | Entered by the forwarder when preparing the consolidated cargo manifest. 3 digits |

**The code system differs depending on whether it's FCL or LCL.** In other words, even for the same cargo, how it's loaded changes the identification structure.

<img src="/assets/mermaid/5bb3ea8e8ac7a766.svg" alt="화물 식별자 계층 — 적하목록에 MRN 이 붙고 그 아래 마스터 B/L 일련번호인 MSN 이, 혼재화물의 경우 다시 하우스 B/L 일련번호인 HSN 이 붙는다. FCL 은 마스터 B/L, LCL 은 하우스 B/L 로 이어진다" style="max-width:100%;height:auto;" />

**Port identification codes** — Indicate where cargo is going from and to. Just as aviation has IATA codes, ports have their own identification codes.

## Terminal equipment identification codes

[In #1, I couldn't answer "if the STS crane is called a QC, what's the yard crane called?" and left it hanging](/en/posts/port-domain-01-what-is-a-smart-port). It came up here.

- **Quay cranes** — QC, gantry crane, C/C. Cranes that work at the apron
- **Yard cranes** — RTGC, RMGC, ARMGC, ASC. Cranes that stack containers
- **Transfer equipment** — YT, AGV

## South Korea's port logistics systems

- **PORT-MIS (Port Management Information System)** — Operated by the Ministry of Oceans and Fisheries and the port authorities
- **UNI-PASS (electronic customs clearance system)** — Export/import declarations, manifest submission, cargo tracking by cargo management number

> This is where we get the data we'll be analyzing.

## Public data is just a record

From here on it was about data. The **data analysis procedure** presented in the lecture was:

> Define the question → locate the data → verify reliability → determine units → begin analysis

The question comes first, the data comes after. And this was added:

> Public data is **just recorded, nothing more.** So it needs to be processed. It needs to be preprocessed.

**Public data** is material that a public institution creates or acquires and manages while carrying out administrative and public duties. It's managed in the order: public duty → electronic record → management/accumulation → disclosure/utilization.

### Turning administrative work into data

Arrival notification → facility use → arrival/unloading → departure → analysis data

Seeing this sequence made the earlier statement click. **Because it's data used within a business process, it's not well-suited for direct use in analysis.** It wasn't created for analysis in the first place — it's a record made to process a task.

### Data humans read vs. data machines read

- **Data humans read** — Data inside images or PDFs. Requires manual re-entry
- **Data machines read** — CSV, JSON. Can be automatically selected and combined

### Scope of disclosure

- Personal information, safety information, and security information are restricted
- Trade secrets and third-party rights are also protected

### Information disclosure and public data provision are different things

| | Information disclosure | Public data provision |
|---|---|---|
| Purpose | Viewing documents/reports, checking content and results | Access to source statistics, new aggregation/combination |
| Format | Mainly PDF | Mainly CSV, API |

### Provision method — files or API

- **File data** — Everything up to the current point at once. CSV, XLSX. Convenient for exploring structure
- **Open API** — Send a condition, get a response back. JSON, XML. Good for repeated collection

I also learned the criteria for choosing between them.

- **When files are convenient** — Quickly exploring the overall structure, viewing past data all at once, one-off analysis
- **When an API is convenient** — Repeatedly collecting the latest values, automating with varying conditions, regular updates

Formats: CSV (comma separated values), JSON (`"key":"value"`), XML (hierarchical structure, less used these days as JSON has taken over).

For an API's real-time-ness, think of it as **accessibility → reference point in time → update cycle**, and fetch data according to that update cycle.

The **Public Data Portal** is an integrated platform that opens up data managed by the government and public institutions.

## Retrospective — the sense of picking a key

The IMO number is what stuck with me most. It doesn't change until the ship is scrapped, so that's what you should use for analysis.

[When cleaning raw data during my data engineering studies](/en/posts/de-study-01-dirty-data-and-staging), I remembered how a category split apart because of a single case difference in letters. That was a problem of unifying values. Here, it's a problem of **which column to choose as the key in the first place**. Join on ship name, and it breaks the moment the ship's name changes. Join on call sign, and it breaks the moment nationality changes.

And the phrase "public data is just a record" sounded like the same idea to me. It's a record left behind by an administrative process, not shaped for analysis — which is exactly why staging is necessary.

## Things to study further

- **Is a separate B/L issued for export and for import** — For the same cargo, is the B/L issued multiple times, or does one B/L just get passed along?
- **The actual specification of port identification codes** — I only heard that they correspond to IATA codes, but what system do they actually use? (I think I've seen something about a UN code)
- **The differences between the four types of yard cranes** — What distinguishes RTGC, RMGC, ARMGC, and ASC. I think the "A" in front stands for "automated," but I need to check
- **Could you reconstruct the process just by looking at the data?** — Right now I'm learning the process first and then looking at the data, but could you go the other way and reconstruct the workflow just from logs? Is this what the field of process mining covers?
- **What items can actually be obtained from PORT-MIS and the Public Data Portal** — I should check directly how much is disclosed and what's restricted
- **How the MRN check digit is calculated** — If the last digit is for verification, what algorithm is used?