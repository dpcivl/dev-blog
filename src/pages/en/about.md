---
layout: ../../layouts/AboutLayout.astro
title: "About"
---

**Park Hyoin (박효인)**

1 year in embedded HW, 2 years 2 months in embedded SW (2022-10 – 2025-12). I currently build and run [Julgot](https://julgot.com) and [this blog](https://parkhyo.in), and I keep a Spring Boot and PostgreSQL study log as [a series](/series).

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

## Experience

**Previous employer** (environmental instrumentation · embedded AI R&D) · 2022-10 – 2025-12
Embedded HW engineer → embedded SW engineer

I come from a humanities background. I self-taught C and earned the Korean Industrial Engineer Information Processing certification, then picked up Python to read the company's embedded SW code. After the SW developer left, I took over embedded SW maintenance.

- **Rain-gauge datalogger HW** — Owned circuit design in OrCAD along with PCB testing and debugging. Replaced an overheating chip in the power section following the datasheet reference, which resolved the heat problem, and completed handoff to the production team for mass production (sales fell short, so mass production never went ahead).
- **Rain-gauge datalogger SW** — Replaced 0.3-second polling bounce detection with a threading-based approach. Traced the MQTT structure and fixed values drifting apart between the dashboard and the logger through JS changes, and added a new 10-minute rainfall data field.
- **Edge AI fire detection** — Ran object detection on the NPU of NXP iMX8M Plus and iMX93 boards, applied transfer learning with Roboflow's public fire dataset, and verified detection against tablet footage. mAP 85.50% (at IoU 0.50 · fire AP 86.22% / smoke AP 84.79%).
- **LoRa communication suitability testing** — Built an unattended test rig from a RAK7248 gateway and RAK3272S nodes (nodes logged transmissions to an SD card; the gateway verified reception over MQTT topics). Walking measurements in a park showed data loss beginning around the 2 km mark.
- **Village-broadcast receiver firmware** — Took a GD32 main chip through boot and peripheral verification with PlatformIO and a PowerWriter debugger. Work ended mid-LVGL UI development when the lab closed.

## What I'm working on now

- **[Julgot (줄곧)](https://julgot.com)** — A journal app that records only what went well. Built on Next.js (PWA) with Supabase Edge Functions (Deno). Web PWA v0.3.2 shipped on 2026-07-13 and is in beta testing. → [launch day 1 retrospective](/en/posts/julgot-launched-day-1-retrospective)
- **[This blog](https://parkhyo.in)** — Astro 5 + Tailwind CSS 4 + Vercel. I decided the design direction, information architecture, and publishing workflow myself, and paired with Claude Code on the code side. → [what I added on top](/en/posts/blog-beyond-astropaper-what-i-added)
- **Study log** — Working through Spring Boot (REST · JPA · transactions · embedded Tomcat/thread pools · JVM/GC) and PostgreSQL/SQL fundamentals as [a series](/series). ([Spring Boot](/en/tags/spring-boot) · [Java](/en/tags/java) tags)

## Contact

- GitHub — [@dpcivl](https://github.com/dpcivl)
- Email — dpcivl713@gmail.com
- Blog — [parkhyo.in](https://parkhyo.in)
