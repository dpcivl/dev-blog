---
layout: ../../layouts/AboutLayout.astro
title: "About"
---

**Park Hyoin (박효인)**

After **1 year in embedded HW and 2 years 2 months in embedded SW**, I'm now moving toward **backend and Java**. My work was inside the device — producing data and shipping it up to a server. Now I want to handle the other side, where that data is received, stored, and served, so I'm digging into Spring Boot, JPA, and the JVM.

<div class="cta-box">
  <a href="/portfolio" class="cta-btn cta-primary">
    <span class="cta-icon">📁</span>
    <span>Portfolio</span>
  </a>
  <a href="https://github.com/dpcivl" target="_blank" rel="noopener noreferrer" class="cta-btn">
    <span class="cta-icon">💻</span>
    <span>GitHub</span>
  </a>
  <a href="mailto:dpcivl713@gmail.com" class="cta-btn">
    <span class="cta-icon">📧</span>
    <span>Email</span>
  </a>
</div>

## Career

I started my career in **embedded hardware design** (OrCAD · PCB testing and debugging) coming from a humanities background, then **self-taught C** and earned the Korean Industrial Engineer Information Processing certification to expand my scope.

Later I picked up Python to read my company's embedded SW code, and after the SW developer left I **took over embedded SW maintenance** (rain-gauge datalogger SW, village-broadcast receiver firmware, and similar systems). I replaced the datalogger's 0.3-second polling bounce detection with a threading-based approach, and traced the MQTT structure to fix values drifting apart between the dashboard and the logger.

When edge AI research started, I owned **NPU object detection and transfer learning from Roboflow's public fire dataset on NXP iMX8M Plus and iMX93 boards**, verifying that real-time inference held up on the hardware (fire detection mAP 85.50%).

Across those three years, what kept catching me was what happened after the data left the device. MQTT broker structure, keeping dashboard and logger values in sync, choosing collection intervals — the problems didn't stop at the edge of the device. Wanting to handle that side properly is what pointed me at backend.

## What I'm working on now

- **Backend · Java** (my current focus) — Working through Spring Boot in order — REST · JPA · transactions · embedded Tomcat/thread pools · JVM/GC — kept as a [running series](/series). I'm also covering PostgreSQL and SQL fundamentals so I can work with queries directly. (Collected under the [Spring Boot](/en/tags/spring-boot) and [Java](/en/tags/java) tags.)
- **[Julgot (줄곧) — an achievement-only journal](https://julgot.com)** — Inverting the "first place or zero" pattern common in perfectionists: **a journal app that records only what went well**. The product grew out of my own [perfectionism retrospective](/en/posts/perfectionism-as-a-tool-vertical-slice-development). Stack: **Next.js (PWA) + Supabase Edge Functions (Deno)**. Web PWA v0.3.2 launched on 2026-07-13. Currently in beta with ongoing maintenance before native app development — see [launch day 1 retrospective](/en/posts/julgot-launched-day-1-retrospective).
- **Blog infrastructure itself** — Astro + Tailwind 4. I decided the design direction, information architecture, and publishing workflow myself, and paired with Claude Code on the code side for a 7-phase modern redesign. Every page including this one is the result.

## Interests

- **Backend** — API design · transactions and concurrency · how the JVM behaves · query performance
- **Where devices meet servers** — IoT data collection · MQTT · inference at the edge. The continuation of three embedded years, and my reason for choosing backend
- **Metacognition · learning methodology** — Efficiency in entering new domains, vocabulary organization, retrospective patterns

## Contact

- GitHub — [@dpcivl](https://github.com/dpcivl)
- Email — dpcivl713@gmail.com
- Blog — [parkhyo.in](https://parkhyo.in)
