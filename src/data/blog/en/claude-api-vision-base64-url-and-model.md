---
title: "Claude Vision — How Do You Send Images In, and Which Model Should Receive Them"
description: "I tried both ways of sending images — base64 encoding and URL — and found them accurate but more token-costly, hit limits with small text and complex shapes, and got a sense of when to move up to a bigger model for tasks that need accuracy."
pubDatetime: 2026-05-15T12:30:00Z
tags:
  - claude-api
  - vision
  - llm
  - 학습
draft: false
featured: false
---

Short one today. I tried out Claude API's Vision feature for the first time.

## Table of contents

## Two Ways to Send an Image

### 1) Attach directly in the body via base64 encoding

Convert the image file into a base64 string and put it in an `image` block. The advantage is that **the image doesn't need to be hosted externally**. This is a good fit for sending a local file straight to the model.

### 2) Reference by URL

If the image is already publicly available on the internet, you just pass the URL. The message payload stays light, and it's efficient when you reuse the same image multiple times.

My impression was that both methods produce no difference in result quality. It's **an option you pick based on the situation**, not a matter of one being better than the other.

## More Expensive Than Text — Input Tokens

When you include an image, the same question **costs a lot more in input tokens.** Compared to a plain text prompt, the difference was clearly noticeable. Once an image gets converted into tokens, the cost goes up.

→ In the end, you have to keep asking yourself "is this a task worth using Vision for?" every time. If something can be solved with text, solving it with text is the right call.

## Limitations — Small Text and Complex Diagrams

Vision isn't a cure-all. It often misses in the following cases:

- **Small text** (tiny fonts in screenshots, labels, captions, etc.)
- **Complex diagrams** (drawings with many overlapping lines or densely packed components)

For these cases, it looks like you need supplementary approaches — cropping the image and sending it in parts, or combining it with a separate tool like OCR.

## When You Need Accuracy, Move Up to a Bigger Model

All my previous examples were done with **Haiku** (the smallest, fastest model). But in an experiment today — **converting a hand-drawn wireframe into HTML code** — I switched the model to **Sonnet**.

The reason was simple. Accurately reading a wireframe, inferring intent from it (layout / component separation), and translating that into code is **a step harder than simple recognition**, so it needed the reasoning power of a bigger model.

> For tasks that need accuracy, use a bigger model. For fast, lightweight classification or tagging, use a smaller one.

Once I felt this dividing line firsthand, it became clear that model selection isn't simply "use the best model available" — it's **something you choose based on the difficulty of the task**.

## Summary

- Attaching images: **base64 or URL**, choose based on the situation.
- **Input token cost is higher than text** — use Vision only for tasks that truly need it.
- Recognition of **small text and complex diagrams** is weak. Needs supplementary measures.
- **Use a bigger model for tasks that need accuracy** (Haiku → Sonnet → Opus).

## Things to Study Further

### 1. How image tokens are calculated

- Exactly how many tokens one image converts into (relationship with image size)
- The tradeoff between shrinking a large image to cut cost vs. losing recognition accuracy
- Reference: [Anthropic Vision docs](https://docs.claude.com/en/docs/build-with-claude/vision)

### 2. Comparing Vision performance across models

- Comparing accuracy, latency, and cost when Haiku / Sonnet / Opus receive the same question about the same image
- How model choice differs between reasoning-type tasks like "wireframe → HTML" versus simple recognition tasks like "is there a cat in this image"

### 3. Where to fit this into a real service

- Places to plug Vision into my solo app: auto-tagging based on user-uploaded images, assisting with receipt OCR, converting handwritten notes → text, etc.
- Cost control: caching, resizing images beforehand, prompting users to re-upload only for cases where recognition clearly failed

### 4. Combining with OCR

- Patterns for supplementing the small-text recognition limitation with OCR
- Some tasks with OCR only, some with Vision only, and some by combining both results

## Reflection

The biggest impression Vision left me with wasn't "looking at an image" itself, but rather **"reading intent from an image and reasoning about it."** A wireframe is just a drawing of lines and boxes, but the flow of interpreting it as "this is the header, this is the content, this is the footer" and translating that into HTML feels different in kind from plain OCR.

And this was the first time I **consciously switched models**. Up until now it was mostly "Haiku is fast and cheap, so." But actually making the judgment call to switch models when a task needs accuracy made me feel like my sense of working with LLMs grew one notch further.