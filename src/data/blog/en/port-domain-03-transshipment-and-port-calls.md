---
title: "Studying the Port Domain #3 — Transshipment Is About Connecting Time and Space"
description: "Transshipment is the main business of Busan Port. I looked at why cargo that just switches ships without crossing the customs line is tricky, and traced the full procedure a ship goes through from arrival notification to departure settlement. Port stay time turns out to be the go-to metric for port efficiency."
pubDatetime: 2026-08-25T06:55:00Z
tags:
  - K-뉴딜아카데미
  - 항만도메인공부
  - 환적
  - 물류
  - 도메인지식
  - 학습
draft: false
featured: false
---

[In #2 I looked at the export/import process](/en/posts/port-domain-02-export-import-process), but it turns out Busan Port's main business isn't either of those. It's **transshipment**.

## Table of contents

## Busan Port runs mainly on transshipment

Transshipment happens a lot because of geography. According to the lecture, Busan Port **gained an edge in transshipment because its IT systems are more advanced than Japan's**. Though lately, apparently, a lot of that volume has been leaking toward Shanghai.

(I recall seeing somewhere — maybe the Busan Port Authority webzine or some material — that Busan ranked 2nd in the world for transshipment. I should double-check the current ranking.)

## What is transshipment

- Cargo **switching ships at an intermediate port**
- The act of moving cargo **from a feeder service to a main line**

Sometimes transshipment happens because cargo loaded on several small ships gets consolidated onto one large ship to be sent out together. This can involve moving between terminals, so timing has to be factored in.

## The handling procedure for transshipment cargo

1. **The feeder ship arrives at Busan Port** and discharges its containers
2. Since this cargo is just switching ships, it **doesn't need to cross the customs line**
3. It goes to a storage yard. **It isn't even inspected.** It sits in a bonded area waiting
4. Once the transshipment vessel arrives, the cargo is loaded and the ship departs

<img src="/assets/mermaid/f64a812cbf4dff28.svg" alt="환적 화물 처리 흐름 — 피더선이 입항해 양하한 컨테이너는 관세선을 통과하지 않고 보세구역에서 대기하다 메인라인 선박에 선적되어 출항한다. 관세선을 넘지 않으므로 수입통계가 아니라 항만 처리량으로만 잡힌다" style="max-width:100%;height:auto;" />

Step 2 was the most interesting part to me.

> Because the cargo doesn't cross the customs line, **only port usage fees are incurred.** It doesn't show up in Korea's import statistics at all. It only registers as port **throughput**.

In other words, the same container passing through the port ends up in different statistics depending on whether it's classified as an import or a transshipment. This made me realize that before looking at any number, you need to ask "which population does this number belong to?"

## Problems that arise with transshipment

The lecture broke this down along two axes.

### The difficulty of connecting in time

If the timing between the first ship and the second ship doesn't line up, it's a dead end.

- If cargo sits in the container yard **too long**, costs go up
- Pulling it out **too fast** also causes problems
- If one feeder ship is delayed — the main ship doesn't have the slack to wait for it

### The difficulty of connecting in space

This comes from movement between terminals. If the first ship docks at Terminal A in Busan New Port and the second ship docks at Terminal B in the same port, cargo has to make an **inter-terminal move**. This is where delays happen.

This kind of move is called **ITT (Inter Terminal Transportation)**, and poor information exchange around ITT creates inefficiency.

This is where it clicked for me that transshipment isn't "switching ships" — it's **connecting time and space**. And both of those problems only get solved when information flows back and forth on time.

## The arrival and departure process

I also looked at the procedure for a ship coming in and going out.

**1. Pre-arrival notification** — Requires authorization from the port authority. This is handled electronically through the **Port Management Information System (PORT-MIS)**. It includes information like the ship's name, call sign, IMO number, gross tonnage, length, and draft. This has to be filed several days before arrival.

**2. Berth allocation** — The ship is assigned a berth. At this point, the port operator registers the **ETA and actual arrival time** in the system.

**3. Port approach and traffic control** — A pilot boards the ship to assist with docking. The ship is monitored by the **Vessel Traffic Service (VTS)**, and its route and entry order are determined using **radar and AIS**.

**4. Piloting, tugging, and berthing**

**5. Arrival procedures** — **CIQ (Customs, Immigration, Quarantine)** processing. This generates data such as clearance documents, all handled as electronic documents. This happens after the ship has docked.

**6. Loading/unloading operations** — The time a ship spends at the berth is called **port stay time**, and this is **the representative metric for port efficiency**.

**7. Departure** — After loading/unloading is complete, the departure notification is processed and port facility usage fees and other charges are settled. A pilot boards again for departure, and the ship is monitored by VTS.

## Retrospective — the metric comes into view first

This felt similar to [when I looked at demurrage in #1](/en/posts/port-domain-01-what-is-a-smart-port). Saying that port stay time is the representative metric for port efficiency, flipped around, means **what needs to be reduced in this domain is already decided**.

The same applies to transshipment. If time-connection and space-connection are the problems, then what needs improving narrows down to how accurately you know "when will it arrive" and "where is it now." That's why the procedure of registering ETA in the system stood out to me.

## Things to study further

- **Feeder routes vs. main routes** — what criteria separate them, and how much of each comes into Busan Port
- **The relationship between mother vessel, feeder ship, and main line vessel** — In my lecture notes I wrote "mother vessel = the first ship you board = feeder ship," but I think I've also seen "mother vessel" used to mean the large main ship. I need to sort out the terminology
- **Whether port stay time includes waiting time in the anchorage** — Since port stay time was defined as time spent at the berth, I'd guess time spent waiting for arrival authorization is excluded. So which metric captures that waiting time?
- **Busan Port's transshipment ranking and trend** — check the actual numbers for its world ranking and how much volume has shifted to Shanghai
- **How ITT actually operates** — who arranges the inter-terminal move and who bears the cost
- **AIS data** — I heard that vessel location is available as public data. I want to find out how much of it I can actually access