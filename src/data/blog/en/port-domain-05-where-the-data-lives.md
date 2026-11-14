---
title: "Studying the Port Domain #5 — Busan Port Is One Space, But the Data Is Scattered"
description: "On whether to get public data as files or via API, and what the Ministry of Oceans and Fisheries, Busan Port Authority, and Korea Customs Service each hold. A record of learning that even though everything happens in one port, the data is split across different agencies."
pubDatetime: 2026-08-26T07:20:00Z
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

Having seen [in #4 why public data can't be used as-is](/en/posts/port-domain-04-identifiers-and-public-data), this time it's about where and how to actually get it. I covered enough theory yesterday, so I went straight into this.

## Table of contents

## There Are Two Ways to Get It

Public data is provided through two channels.

- **File data** — downloading files directly. Usually Excel or CSV is uploaded, and sometimes JSON is given too
- **Open API** — communicating through a programming language

For this course, I'll be analyzing using **file data**. The Open API requires getting a key issued first.

### Why Does the API Need a Key

Because it's downloaded through a programming language. So you apply through **a data usage request**, get approved, and obtain a key issued from that.

The lecture said that once you understand this principle, you can do two more things.

- **The same principle applies when using external services through a program**
- **You can do data analysis across many fields without being tied to one domain**

I liked the second point. Right now I'm working with port data, but the procedure itself — getting a key issued and calling an API — is the same regardless of domain.

## Maritime and Port Data Is Split Across Three Agencies

- **Ministry of Oceans and Fisheries** — vessel arrivals/departures, port facilities
- **Busan Port Authority** — Busan Port operations, long-term cargo volume
- **Korea Customs Service** — items, imports/exports by country

And this is the part that stuck with me most from this lecture.

> **The data is distributed.**

Busan Port is a single space. The export/import process, the arrival/departure process — all of it happens in that one port. But the data coming out of it is **managed separately by multiple organizations.**

So when you set a topic and go to pull data, you might not be able to get everything from one place — you **may need to pull from each agency separately.** Each agency specializes in handling different data.

<img src="/assets/mermaid/ecfc72ac4b0fa786.svg" alt="The data for what happens in Busan Port, a single space, is managed across three agencies — Ministry of Oceans and Fisheries handles vessel arrivals/departures, Busan Port Authority handles cargo volume, and Korea Customs Service handles items and amounts" width="796" height="422" style="max-width:min(100%, 796px);height:auto;" />

## What Each Agency Holds

### Ministry of Oceans and Fisheries — PORT-MIS

- Provides nationwide maritime and port data
- Vessel arrival/departure and port usage information
- Covers various fields including shipping, fisheries, and marine environment
- Can be broken down by **port, vessel type, and tonnage class**
- Convenient for comparative analysis across ports nationwide
- Suitable for analyzing port operations and shipping trends

An important caveat was attached here.

> PORT-MIS is actually **a tool used by vessels**. So to query data here, you need to know **information that identifies the vessel**.

[What I learned in #4 about using IMO numbers as analysis keys](/en/posts/port-domain-04-identifiers-and-public-data) connected directly to practice here. Knowing the code system isn't just general knowledge — it's **a query condition**.

### Busan Port Authority

- Specialized data centered on Busan Port
- Container and cargo volume
- **Export, import, and transshipment performance can be distinguished**
- Can be broken down by year, month, and pier
- Convenient for analyzing Busan Port's cargo volume trends
- Suitable for analyzing Busan Port's operational performance and competitiveness

[I learned in #3 that transshipment doesn't show up in import statistics and only shows up as throughput](/en/posts/port-domain-03-transshipment-and-port-calls), but here you can apparently view exports, imports, and transshipment separately.

### Korea Customs Service

- Trade data centered on exports/imports and customs clearance
- Item classification based on **HS Code**
- Can be broken down by country and item for exports/imports
- Provides export value, import value, weight, and trade balance
- Convenient for trade analysis by item and trading country
- Suitable for analyzing export/import trends and trade structure

Laying the three agencies side by side, their axes are different. The Ministry of Oceans and Fisheries looks at **vessels**, Busan Port Authority looks at **cargo volume**, and Korea Customs Service looks at **items and amounts**. The same single container ends up recorded with a different face at each of the three agencies.

## What Does a Data Analyst Actually Do

Toward the end of the lecture, there was a discussion about attitude.

> - A data analyst is **not a fortune teller.**
> - **pandas is not invincible.** It's just a tool that makes handling data easier.
> - The data analyst is the one doing the work, and pandas is the tool. That's why a data analyst **needs to study statistics.**

And the analysis flow was summarized like this.

> If you look at data carefully, new facts become visible. Using those facts to **form a hypothesis and verify it with data** — that's what analysis is.

That last sentence overlapped with [something I heard in #1](/en/posts/port-domain-01-what-is-a-smart-port).

> A data analyst **doesn't make decisions** — they only analyze and **communicate** the results.

In #1 I learned that "AI shouldn't make the decision — AI contributes to decision-making," and the analyst's role sits in the same place. Whether it's a tool or a person, the role isn't to decide — it's to build the grounds for judgment.

## Reflection — Being Distributed Is the Challenge Itself

When I first heard "the data is distributed," it sounded like a mere inconvenience. But after hearing all three agencies introduced, it started to look like the defining characteristic of this domain.

[In #2 I learned that shippers, forwarders, shipping lines, and terminal operators each generate their own data.](/en/posts/port-domain-02-export-import-process) Since the actors are divided, the data is divided too. So the fact that there are three agencies isn't a coincidence — it's **a direct reflection of how the work itself is structured.**

If that's the case, the hard part of analysis probably won't be reading each individual file, but **tying together data from different agencies around the same subject.** Thinking back to [how a single difference in uppercase/lowercase split a category apart in my DE studies](/en/posts/de-study-01-dirty-data-and-staging), I suspect the real workload lies in reconciling differing notations and standards across agencies.

Even when looking at the same topic, perspectives can differ, and reconciling that all the way through to a dashboard is said to be the goal of this course.

## Further Study

- **Why Busan Port Authority data and PORT-MIS are kept separate** — whether it's because Busan Port Authority's data is specialized, or whether the jurisdictions were simply different from the start. If the same item exists redundantly in both places, I'm also curious which one should be treated as the standard
- **What "gyeseon" in "gyeseon location" actually means** — since I saw [the mooring post (gyeseonju, a post for tying up a ship) in #1](/en/posts/port-domain-01-what-is-a-smart-port), this looks like a related term, but I need to confirm exactly what kind of location a "gyeseon location" refers to
- **What key is used to join data across agencies** — vessels have IMO numbers, but what key links cargo volume and item data together? Whether the structure even allows for joining in the first place
- **Differences in update timing between file data and the API** — even for the same data, if the file release cycle and the API update cycle differ, the numbers might not match. Which one should be treated as the reference
- **The process for applying to use public data** — how long approval takes and what needs to be filled out. I'm using files for now, but I suspect I'll need this once I get it set up
- **Where to start studying statistics** — it was said that analysts need to study statistics, but between descriptive and inferential statistics, which one gets used first in practice