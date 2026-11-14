---
title: "Building a Minecraft Mod with Agentic AI — A Simple Escape Room"
description: "I don't want to play games, but I didn't want to be distant from my family who plays Minecraft, so I built a mod as practice for Agentic AI. I set up an agent pipeline that takes a design doc all the way to real playtesting, and built a 3-room escape room in 3 hours."
pubDatetime: 2026-10-10T15:00:00Z
tags:
  - agent
  - 바이브코딩
  - 사이드프로젝트
  - 마인크래프트
draft: false
featured: false
---

## Why I started

My wife and her sister's couple play Minecraft. I don't want to play games myself, but I also didn't want to feel too disconnected from the three of them playing Minecraft. So I started building a Minecraft mod as practice for Agentic AI.

This was a simple hobby project, done through vibe coding. In the end, I used Agentic AI to build a simple escape room mod.

## Table of contents

## What I'm building

- A game that 4 people can play together in Minecraft Java Edition. I'm planning escape rooms, RP, simulations, and more
- The **Agentic AI for mod generation** that will build it — you throw it a design doc, and it implements it all the way to real testing
- My goal is to try recreating mods made by well-known YouTubers. This is for personal use only, with no commercial intent

I used version 1.21.1, since that's the version AI can build well with. As of Claude Sonnet 5.5 (checked 2026-10-10), it's the version with the most available material. I built the mod using the Fabric API.

## I built the agent first

My first thought was that I needed to build the Agentic AI before I could automate anything.

After building subagents for the Agentic AI, I set up an HTML dashboard on a server so I could see which agent was currently working. I used PixelOffice as a reference.

![Agent workflow dashboard. At the top, the main session (orchestrator) is working, and below it are nodes for game-designer, api-researcher, mod-implementer, test-runner (build/test), qa-simulator (4-player simulation), and reviewer (code review). On the right, there's a review inbox card showing "Approval needed · M1 Party Core spec approval"](/assets/posts/agentic-ai-minecraft-mod-escape-room/01-agent-workflow-dashboard.webp)

- The orchestrator (main session) listens for instructions and hands off work to the relevant process
- I set up agents for game design, API research, implementation, build and testing, 4-player simulation, and code review
- Once the target implementation was done, I'd get a notification to run a real test

Along the way, I integrated real-test controls into the HTML dashboard. I added a "Run Playtest" button and checkboxes for marking pass/fail, making it easy to record test results.

![Playtest screen. Next to the "Start Playtest" button are status indicators for Server · Client windows (0/4) · Connected (0/4), followed below by step-by-step instructions for "All 4 players," expected results under "This is what it should look like," and Pass/Fail buttons](/assets/posts/agentic-ai-minecraft-mod-escape-room/02-playtest-checklist.webp)

## How far I got

I developed this for about 3 hours.

- Confirmed the 4-player party feature works
- Confirmed basic escape room puzzle features work — password input puzzle, color sequence puzzle, simultaneous input puzzle, hint system, and other basics
- Built a simple 3-room escape room, but the puzzle difficulty is too easy

I wanted to check whether AI could implement things like structure-based clues, or existing escape room gimmicks. So I had it look up escape room gimmick references and implement them, and that work is now done. I'm currently waiting to run a real playtest. I'm planning to test it with my wife, her sister, her sister's husband, and myself — four of us.

I got as far as opening the server and having my wife and me join and play. But since the game only starts once 4 people have joined the party, I haven't been able to run the actual gameplay test yet.

## What I learned

### I've used role-based agents before, but this is the first time I automated it this way

I've worked on personal projects before using separate agents for design, implementation, code review, code quality, and security. I've also built pipelines to run things in sequence. But I'd never had a main session hand off work to subagents and automate it the way I did this time.

Drawing on my experience splitting up work like this, I think visualizing the process and writing specific prompts should be enough to make it work.

### Minecraft turned out to build structures better than I expected

When I previously built places in Roblox, I often ran into objects overlapping, misaligned coordinates, or structures that didn't match the intended concept. Maybe because there's far more material out there for Java-based Minecraft than for Luau, the game I built today ended up with decent quality overall.

### I need to watch how things get implemented, not just hand off the implementation

I realized I need to pay more attention to how things actually get implemented, rather than just delegating the implementation itself. Just like at work, if I review what decisions are being made for verification purposes, I suspect I'll eventually come across concepts I can reuse somewhere.

## Things to study further

For the things I don't do myself, how does an agent verify them — not in a human way, but in an AI way?

- When a structure is used to express something, how do you know it's expressed correctly? After building something meant to represent a lab, how do you verify that it actually reads as a lab?
- How should 4-player state be managed on the server side, and how should it be synchronized on the client side?