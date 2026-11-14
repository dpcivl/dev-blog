---
title: "I thought it was predictive maintenance, but it was condition-based maintenance"
description: "While building an equipment anomaly detection model, I looked into predictive maintenance and realized what I was actually trying to do was a step before that. Here I organize the four types of maintenance and the five stages of predictive maintenance."
pubDatetime: 2026-10-01T12:00:00Z
tags:
  - 예지보전
  - 이상탐지
  - 제조AX
  - 학습
draft: false
featured: false
---

While working on time-series analysis of equipment energy efficiency, I ended up building an anomaly detection model.
I don't work at the level of looking at individual parts, but since this seemed like something widely used in manufacturing AX, I decided to look into it.

It started with the keyword "predictive maintenance" and trying to check whether I could apply it to what I was currently working on.
But after looking into it, **what I was trying to do wasn't predictive maintenance.**

## Table of contents

## Maintenance is divided into four types

| Type | What it does | Problem |
| --- | --- | --- |
| **Breakdown Maintenance (BM)** | Fix it when it breaks | Low cost, but sudden line stoppages cause losses |
| **Preventive Maintenance (PM)** | Inspect and replace parts on a fixed schedule | Reduces failures, but wastes resources replacing parts that are still fine |
| **Condition-Based Maintenance (CBM)** | Monitor condition via sensors and service when values exceed a threshold | — |
| **Predictive Maintenance (PdM)** | Learn patterns in condition data to predict when failure will occur and optimize maintenance timing | — |

It was only after reading this far that I understood.
**I thought I was trying to introduce predictive maintenance into equipment anomaly detection, but what I was actually thinking of was condition-based maintenance.**

Alerting when a value crosses a threshold and predicting in advance when it will cross that threshold are different things.
I realized that to do AX properly, I needed to understand predictive maintenance more precisely and in more detail.

## Predictive maintenance proceeds in five stages

<img src="/assets/mermaid/69f589ae62409f4d.svg" alt="5 stages of predictive maintenance — from data collection to linking with maintenance decisions" width="1315" height="118" style="max-width:min(100%, 1315px);height:auto;" />

1. **Data collection** — Gather sensor data, equipment operation history, and maintenance history
2. **Anomaly detection** — Detect patterns that differ from the normal state
3. **Fault diagnosis** — Determine which component has what type of problem. In terms of the work I do, this could mean a situation where fuel consumption at a specific piece of equipment becomes higher than usual
4. **Remaining useful life (RUL) prediction** — Estimate the time remaining until failure
5. **Linking to maintenance decisions** — Connect the prediction results to maintenance plans, the maintenance management system, MES, etc., so they translate into actual work orders

## How far is this actually used in practice?

Apparently, many projects referred to as "predictive maintenance" in the field **actually only implement up to stage 2, anomaly detection.**

Remaining useful life prediction requires enough accumulated failure history data, and **the better-maintained the equipment, the less failure data there is**, which makes this difficult.
So it's common to start at the pilot stage with anomaly detection and early warnings, then expand into diagnosis and lifespan prediction as data accumulates.

### Accuracy is a metric you can't use

Since failures occur rarely, accuracy is often not a suitable performance metric.
**Even a model that always predicts "normal" can achieve 99% accuracy.**

In predictive maintenance, other things matter more.

- How few failures were missed (recall)
- How frequent false alarms are
- How many days in advance of failure the alarm was raised (lead time)

In my case, I think it should be possible to detect anomalies by training on sensor data, operation records, and maintenance history.

## Things to study further

- **Remaining useful life (RUL) prediction models** — How to approach this when failure data is scarce. NASA's [C-MAPSS turbofan dataset](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) is frequently used as a benchmark in this field
- **Comparing anomaly detection techniques** — Whether statistical methods (control charts, thresholds), machine learning (Isolation Forest, One-Class SVM), or deep learning (autoencoders, LSTM) is right for time-series equipment data
- **How to evaluate lead time** — To turn "how many days before failure the alarm was raised" into a metric, I need to figure out how to define the ground-truth point in time. I need to check whether there's a standardized definition like there is for recall and precision
- **Handling imbalanced data** — In data where failures make up less than 1%, raising recall also raises false alarms. I need a method for deciding where to cut off that trade-off
- **ISO 13374 · ISO 17359** — International standards for condition monitoring and diagnostics. I'd like to compare what terms the standards use for the 5 stages outlined above