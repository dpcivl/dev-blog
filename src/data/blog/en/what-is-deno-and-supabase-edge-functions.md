---
title: "What is Deno? — The Runtime I Met in Supabase Edge Functions"
description: "While building a solo app, I touched Supabase Edge Functions and ran into Deno for the first time. Here's what I found out about what Deno is, how it differs from Node.js, and why Supabase chose Deno in the first place."
pubDatetime: 2026-05-06T06:30:00Z
tags:
  - deno
  - supabase
  - 런타임
  - 학습
draft: false
featured: false
---

While building a solo app, I set up Supabase as the backend. When I went to use the Edge Functions feature, I found that the code environment wasn't Node.js but **Deno**. This post is what I put together after starting from "wait, what is this?"

## Table of contents

## What is Deno

> A runtime for JavaScript and TypeScript.

That's the one-line summary. It's in the same category as Node.js — an environment that **runs JS/TS code outside the browser**.

## How is it different from Node.js

Two differences I looked into directly.

### 1. Permission model — "deny by default, allow explicitly"

- **Node.js**: scripts can freely access the file system / network / environment variables, etc.
- **Deno**: blocks everything by default. If you need network access, you must explicitly grant permission with something like `--allow-net`; if you need file access, `--allow-read`.

```bash
# Node — just runs
node script.js

# Deno — blocked without permission
deno run script.ts                  # fails if it tries to use the network
deno run --allow-net script.ts      # network allowed
```

This is a big difference from a security standpoint. When running a script from an unclear source, it forces an explicit decision like "this script is trying to access the network."

### 2. TypeScript support out of the box

To use TypeScript in Node.js, you usually have to compile with `tsc` or bring in a tool like `ts-node`. Deno **runs `.ts` files directly, no setup needed**. `deno run script.ts` and that's it.

## So why do we need a runtime at all

I paused here again to think it through: "why is a runtime even necessary?"

JavaScript was originally designed to run in browsers. Browsers have an engine like V8 built in that can execute JS, but **to run JS code outside the browser, you need a separate environment to execute it.** That's the runtime (Node.js, Deno, Bun, etc.).

Building an API in JS on a server, writing build scripts in JS, making a CLI tool in JS — all of this is possible because a runtime is installed underneath.

## Why does Supabase Edge Functions use Deno

The next question was: "why did Supabase choose Deno instead of Node.js?"

First, what is an **Edge Function**?

> A small server function that runs at a location geographically close to the user (an edge server).

A traditional API server sits in a single region (say, a US East data center), and every time a user in Korea calls it, the request has to cross the Pacific each time. Edge Functions run on nodes distributed around the world, processing the user's request at a nearby location and **reducing latency**.

The following characteristics fit well with this kind of environment.

- **Fast cold start** (new instances spin up frequently as requests come in)
- **Isolated security model** (a multi-tenant environment where many customers' functions run on the same infrastructure)
- **Simple deployment unit** (deployable as a single file/bundle)

Deno naturally satisfies all three. Its permission model fits security isolation well, running TS directly cuts out the build step, and being built on V8 isolates makes it lightweight to spin up. **Because Supabase adopted Deno as its runtime, writing Edge Functions in my project naturally meant writing Deno code.**

(Other companies have made similar choices — Cloudflare Workers is built on V8 isolates, and some of Netlify's/Vercel's edge runtimes follow a similar direction.)

## Summary

- Deno = a JavaScript/TypeScript runtime (same category as Node.js)
- Core differences: **explicit permissions** + **TS support out of the box**
- Why a runtime is needed: running JS outside the browser requires a separate execution environment
- Why Supabase Edge Functions uses Deno: it fits well with security isolation + fast startup + simple deployment

## Things to study further

### 1. Deno's permission system in more detail

- What permission flags exist (`--allow-net`, `--allow-read`, `--allow-env`, `--allow-run`...)
- How to grant narrower permissions (allowing only specific hosts, only specific paths, etc.)
- Reference: [Deno Permissions](https://docs.deno.com/runtime/fundamentals/security/)

### 2. Deno vs Node.js — API differences

- Where the standard library lives — Deno is import-URL based, Node is npm based
- Using npm packages in Deno via the `npm:` specifier (supported from Deno 1.28+)
- Things to watch out for when porting existing Node code to Deno

### 3. Supabase Edge Functions in practice

- Local development: spinning things up locally with `supabase functions serve`
- Managing environment variables / secrets
- How authentication/connection works with the DB (Postgres) within the same project
- Reference: [Supabase Edge Functions official docs](https://supabase.com/docs/guides/functions)

### 4. Limitations of Edge Functions

- Cold start times can vary depending on the node environment
- There are execution time limits / memory limits — not suitable for heavy workloads
- DB pool management is tricky (creating a new connection per request can blow things up) — how Supabase handles this

### 5. V8 isolates vs containers

- Why edge environments use V8 isolates instead of Docker containers
- Comparing startup time / memory / isolation strength
- Differences between Cloudflare Workers' isolate model and Deno Deploy

## Retrospective

When I first opened the Edge Functions folder and thought "wait, why Deno all of a sudden?" — I ended up learning that **when a company picks a particular tool, working backward from what constraints and goals they had helps you understand why that tool is there.** For Supabase, running a multi-tenant edge environment, Deno isolates were a more natural choice than Node containers.

Next time I run into a new tool, I want to go beyond just "what is this?" and dig further into "what problem were the people who used this trying to solve?"