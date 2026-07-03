---
title: "The Day Claude Code Suddenly Stopped Working — the 529 Overloaded Error and the Existence of status.claude.com"
description: "I turned on Claude Code in the morning as usual, but agent calls kept failing with a 'server overloaded' error. A short troubleshooting log tracking down the cause through API Docs, a developer group chat, and status.claude.com — turned out to be a temporary overload on Anthropic's server side."
pubDatetime: 2026-06-22T07:00:00Z
tags:
  - 트러블슈팅
  - claude-api
  - claude-code
  - 일지
draft: false
featured: false
---

![Claude Code agent call failure — 529 Overloaded error message](/assets/posts/claude-code-529-overloaded-jun-2026/01-claude-code-error.png)

I was coding with Claude Code when it kept telling me **agent calls were failing due to server overload**. Here's a short log of tracking down what was going on.

## Table of contents

## 1. Checking the error message

```
API Error: 529 Overloaded. This is a server-side issue,
usually temporary — try again in a moment.
If it persists, check https://status.claude.com.

agentId: a774ac...8bf62
subagent_tokens: 0
tool_uses: 0
duration_ms: 191200
```

Reading it at a glance, it looked like a **temporary server-side issue** — nothing I could really do about it — but I looked into it anyway.

> **529** is in the 5xx range I covered in [my post on API design](./api-vocabulary-for-vibe-coding). It's not a client-side mistake — it's **the server's fault**. If it's temporary, retrying usually fixes it.

## 2. Checking the cause of 529 in the Claude API Docs

![Claude API Docs — definition of 529 Overloaded and when it occurs](/assets/posts/claude-code-529-overloaded-jun-2026/02-claude-api-docs-529.png)

In summary:

- **When an organization's usage suddenly spikes**
- **When overall usage across all users spikes**

This means the server side gets temporarily overloaded. Since I was working the same way I always do in the morning, **it seemed unlikely I was the one calling the agent too much** — more likely this was an internal issue on Anthropic's servers themselves.

## 3. A clue from the developer group chat — `status.claude.com`

![Developer group chat — many people reporting the same error at the same time and sharing the status page](/assets/posts/claude-code-529-overloaded-jun-2026/03-group-chat-confirms.png)

In a developer group chat I'm in, people were dealing with **the same error at the same time** — chaos. **It wasn't just me — many people had the same symptom.** I thought I'd just have to sit and wait for it to clear up, but someone in the chat gave me the tip to check **`status.claude.com`**.

> *(Names in the group chat screenshot have been blurred out.)*

## 4. status.claude.com — Anthropic's official status page

![status.claude.com — showing an ongoing incident in Investigating status](/assets/posts/claude-code-529-overloaded-jun-2026/04-status-claude-investigating.png)

**UTC 00:37** = 9:37 AM Korea time. It showed that an error was currently occurring and was **still being investigated (Investigating)**. Once **"Resolved"** appears here, it means the issue is fixed.

> The existence of a status page like this was itself a discovery. If I ever run a service of my own, having something similar would probably help build user trust.

## 5. Resolution — Opus 4.8 recovered

![Confirming the "Resolved" record in Past Incidents](/assets/posts/claude-code-529-overloaded-jun-2026/05-past-incident-resolved.png)

Once Opus 4.8 recovered, I jumped right back into work, so **I didn't see the "Resolved" status appear in real time**, but I was able to confirm it later in **Past Incidents**.

## Retrospective

I didn't actually fix anything myself — I just waited for it to clear up. But I now have a **clear sequence of steps for next time** something like this happens:

1. **Check the status code in the error message** — 4xx means it's my fault, 5xx means it's the server's fault
2. **Check what that code means in the official docs** (API Docs)
3. **Check the status page** (this time I learned about `status.claude.com`)
4. **Quickly figure out whether it's just me or affecting many people** — group chat / Twitter / Reddit
5. **If it's widespread, wait. If it's just me, check reproduction / code / environment.**

> One thing I want to try next time — **multi-LLM provider fallback**. Automatically switching to OpenAI when Claude is down would minimize work interruptions. However, Claude Code itself is Anthropic-only, so fallback is hard there — but it's possible **in my own API code**.

## Things to study further

### 1. Where 529 stands in the standard

- The official HTTP status code standard (IANA) **doesn't include 529.** It's a non-standard extension
- Some services like Shopify, Cloudflare, and Anthropic use it to mean "site is overloaded"
- The closest standard 5xx alternative: **503 Service Unavailable**
- Reference: [MDN list of HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

### 2. Automatic retry for 529 in the Anthropic SDK

- The automatic retry policy I covered in [my post on error handling](./claude-api-error-handling-and-retry)
- Whether the SDK treats 529 as retryable (usually 5xx is retried, up to a certain number of attempts)
- Choosing between increasing `max_retries` to retry more persistently vs. giving up early and falling back

### 3. The general structure of a status page

- **Incident** (occurs) → **Investigating** → **Identified** (cause found) → **Monitoring** → **Resolved**
- Status pages Korean users commonly check: GitHub Status, Slack, OpenAI, Anthropic
- Tools for running your own status page: Atlassian Statuspage, Better Uptime, Instatus

### 4. Multi-LLM provider fallback patterns

- LangChain's `with_fallbacks()` — automatically falls back to a second model if the first fails
- Libraries like **LiteLLM** — a unified interface across multiple providers
- Cost optimization angle — use a cheap model normally, switch to an expensive one on failure
- Maintaining consistent response quality is a challenge

### 5. Meta information about Claude Code's agents / sub-agents

- The exact meaning of `agentId`, `subagent_tokens`, `tool_uses`, and `duration_ms` shown in the error message
- How Claude Code's agent calls sub-agents (multi-agent orchestration)
- How to make use of this information when debugging
- [Official Claude Code docs](https://docs.anthropic.com/en/docs/claude-code)