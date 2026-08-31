---
title: "Studying the Port Domain #2 — Import/Export Processes and Identifiers"
description: "Shippers, forwarders, carriers, and terminal operators each generate their own data. Following the 8 export stages and 6 import stages, I mapped out where booking numbers, container numbers, B/Ls, and MRNs are issued. It turns out import isn't just export in reverse."
pubDatetime: 2026-08-25T06:40:00Z
tags:
  - K-뉴딜아카데미
  - 항만도메인공부
  - 물류
  - 무역실무
  - 도메인지식
  - 학습
draft: false
featured: false
---

[In #1, I covered what a port actually is](/en/posts/port-domain-01-what-is-a-smart-port). This time it's about how cargo actually moves within one. There was a line the lecture kept repeating.

> **All** of these parties generate data. You have to analyze it using this data.

## Table of contents

## Who's involved

- **Shipper** — The owner of the cargo. Can be either the exporter or the importer. This is the party to the trade contract, and also includes the end customer who purchases the transport service.
- **Forwarder** — An international logistics broker. Designs the entire shipment on the shipper's behalf. Leases containers, arranges vessels. Since they're the ones brokering the contract, the lecture described them as "eternally the weaker party."
- **Carrier** — The ocean carrier. The party that actually owns or leases the ship.
- **Terminal operator** — Handles container operations within the port.
- **Customs broker / customs office** — To actually enter a bonded area, cargo has to pass through the customs line.
- **Port authority** — Handles administrative work that arises at the port.

The lecture also introduced the concept of **consolidation**. When my export volume is small, my goods get mixed into one container with another exporter's goods. It was compared to a shared Netflix subscription.

The part about terminal operators stood out. Busan Port inevitably has **bottlenecks**, and one cause is the terminal operator. Transshipment requires moving containers around, and pulling out and processing multiple containers at once is where the bottleneck forms.

## The export process

You'd think import is just export in reverse, but it isn't. First, the 8 export stages.

**1. Booking transport reservation** — The first task in exporting. You need to find a ship. Instead of contacting the carrier directly, you contact the **forwarder**, who requests space from the carrier. You tell them what cargo, how many containers, and when and on which route you want to ship it. Once the reservation is confirmed, a **booking number** is issued. The specific vessel, voyage, and cargo intake details are finalized, and the **cargo cut-off time (closing time)** is set.

**2. Securing the container** — Containers are usually owned by the carrier. The transport company leases one at a location designated by the carrier. The **container number** is the identifier. The code is written on the container door.

**3. Stuffing** — Loading goods into the container. Once sealed, a **seal serial number** is issued. This is used later to check whether the seal has been tampered with. Containers are billed by weight, and **VGM** is used to measure it.

**4. Export declaration** — Once stuffing is done and the seal number is issued, you can file the declaration. This is notifying customs that the cargo is leaving the country. It's processed electronically through a customs broker (the electronic customs clearance system **UNI-PASS**, which issues the export declaration certificate). **HS Code** is used here.

**5. Terminal gate-in** — Once the export declaration is complete, the cargo can cross the customs line and enter the terminal. They check whether the seal is intact and whether there's any problem with the container. After gate-in, an electronic document notifies the carrier, and the terminal operating system's **yard addressing system** is used.

**6. Loading preparation** — Containers arrive at the terminal before the ship does. Before the vessel arrives, the carrier and terminal finalize the **loading plan**. Containers to be transshipped are stacked on top, and containers going straight through can be stacked below. This loading plan is called the **bay plan (BAPLIE)**.

> Getting this wrong causes demurrage charges. It creates problems both for cargo throughput and port efficiency. The process has to be built well.

**7. Loading** — Once the vessel is berthed, cranes begin unloading and loading operations.

**8. Departure and document completion** — After departure, the carrier issues the **bill of lading (B/L)**. It's like a package delivery slip — without it, you can't receive the goods. It's a **title document** for the cargo. The **B/L number** is the identifier. The exporter's export performance recognition and payment settlement procedures also go through this B/L.

The carrier doesn't really know the contents of the container. In consolidation, multiple companies are tied together, so only one representative party issues the B/L, and insurance is taken out against that.

<img src="/assets/mermaid/a57ffe04fc5f2fd6.svg" alt="수출 업무 8단계 흐름 — 운송예약에서 부킹 번호, 컨테이너 확보에서 컨테이너 번호, 적입에서 봉인 번호와 VGM, 수출신고에서 HS Code, 선적 준비에서 베이 플랜, 출항 후 B/L 이 발급된다" style="max-width:100%;height:auto;" />

> Summary: Booking → Securing container → Stuffing → Export declaration → Terminal gate-in → Loading preparation → Loading → Departure and document completion

## The import process

For export, you just need to receive an empty container, but import doesn't work that way, so the flow is different.

**1. Document submission** — The carrier submits the **manifest** to the destination country's customs office. This must happen **24 hours before arrival**. An **MRN** and a sub-serial number are issued. The documents must be declared before the cargo even arrives.

**2. Arrival and unloading** — The quay crane unloads the container, and it's placed in storage in a **bonded area**. Since duties haven't been paid yet, the importer can't touch it.

**3. Import declaration** — Document submission and import declaration are different things. The importer or a customs broker files the declaration with customs. This confirms the **HS Code**, the price, and so on, and a **physical inspection** may take place at this point.

**4. Freight settlement** — The B/L is held by the carrier. You need to obtain a **delivery order (D/O)** based on the bill of lading before you can take the goods. The D/O is issued as an electronic document.

**5. Release** — The container transport company dispatches a truck to pick up the container. There's a time limit here. If you say you'll release it but don't pick it up, **storage fees kick in after the designated storage period**.

**6. Container return** — The container is the carrier's asset. Once it's done being used, the forwarder takes it back and returns it to the carrier.

<img src="/assets/mermaid/7dc36d7febc6c823.svg" alt="수입 업무 6단계 흐름 — 입항 24시간 전 문서 제출로 MRN 이 발급되고, 입항과 양하 후 보세구역에 장치되며, 수입신고와 운임 정산으로 D/O 를 받아야 반출할 수 있고 마지막에 컨테이너를 반납한다" style="max-width:100%;height:auto;" />

> Summary: Document submission → Arrival and unloading → Import declaration → Freight settlement → Release → Container return

## There are two kinds of B/L

- **Master B/L** — This is the only one the carrier knows about.
- **House B/L** — A split of the master B/L.

This ties back into the structure where multiple shippers are tied together in consolidation.

## Reflection — an identifier is issued at every stage

Of everything I heard in the lecture, this was the line that sounded closest to something relevant to data.

> The **identification code is the most important thing** in data.

Once I traced through the process, it turned out that a number really is issued at every single stage.

| Stage | Identifier issued |
|---|---|
| Booking | Booking number |
| Securing container | Container number |
| Stuffing | Seal serial number |
| After departure | B/L number (master / house) |
| Import document submission | MRN + sub-serial number |

This means each party refers to the same cargo using its own number in its own system. As I saw [in #1](/en/posts/port-domain-01-what-is-a-smart-port), a port is a place where multiple parties each handle a segment of the process, so how these numbers get linked together seems like it'll be the starting point for any analysis.

[When cleaning raw data in my data engineering studies](/en/posts/de-study-01-dirty-data-and-staging), a single case-sensitivity issue was enough to split a category into two. Remembering that, I suspect reconciling identifiers that come in with different formatting from each party won't be easy.

## Things to study further

- **What exactly does a forwarder do** — Their position seemed ambiguous enough that the lecture used the phrase "eternally the weaker party." I want to understand their revenue structure and scope of responsibility.
- **What is an MRN** — I only noted that it's issued when the manifest is submitted, but I don't know what system it belongs to.
- **Incoterms** — I heard these are the rules that determine where cost and risk transfer during the import/export stages.
- **Is inspection a separate stage in the import process** — My lecture notes summary had "import declaration and inspection → import declaration" written twice. I need to check whether this was a note-taking mistake or whether declaration and inspection are actually separate steps.
- **VGM standards and how discrepancies are handled** — What happens if the weight differs from what was declared. How much variance is tolerated in practice.
- **The flow after D/O digitization** — I noted that it's issued electronically, but I don't know which system is used.
- **How the identifiers connect to each other** — How booking numbers, container numbers, B/Ls, and MRNs are actually tied together via key relationships in a database. This feels like the point where domain knowledge and data engineering meet.