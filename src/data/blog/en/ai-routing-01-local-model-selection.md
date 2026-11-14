---
title: "Ollama Local LLM Routing #1 — One big model would do, but I split it into four small ones"
description: "I decided to try routing prompts across several open-source LLMs on my MacBook first. Both my home computer and MacBook fell short on specs, so I had to pick different models, and I finished installing ollama."
pubDatetime: 2026-09-20T13:40:00Z
tags:
  - LLM공부
  - ollama
  - 로컬LLM
  - 학습
draft: false
featured: false
---

I came across a technique where you keep several open-source LLMs around and classify prompts so they get routed to a reasoning model, a coding model, or a design-specialized model depending on the content. It made me want to experience an AI code assistant firsthand.

## Table of contents

## My home computer couldn't do it

My home computer runs a GTX 1660 Super, so VRAM was way too limited. My MacBook has 16GB of RAM.

There's an option to rent an RTX 5090 through RunPod, but before that, I decided to **first try a tutorial on installing several mini models on my MacBook and routing between them**.

## Model selection

I initially wanted to pick models matching what Athena Code uses. But models like Devstral2 needed a lot of VRAM even in their smallest versions, so I had to pick smaller models instead.

I briefed the AI on my MacBook's specs, and since I needed to load multiple models, I set a limit of **around 5GB per model**.

| Role | Model |
| --- | --- |
| Classifier | `qwen3.5-2b` |
| Reasoning | `deepseek-r1:8b` |
| Coding | `qwen2.5-coder:7b` |
| Vision | `gemma4:12b` |

<img src="/assets/mermaid/57746a163e1bb078.svg" alt="Routing structure where a classifier judges incoming prompts and sends them to one of the reasoning, coding, or vision models" width="636" height="278" style="max-width:min(100%, 636px);height:auto;" />

Honestly, using `gemma4:12b` alone would be superior across the board. But since **routing between AI models is the whole point of this project**, I picked things this way instead.

## Progress

- Finished the initial project directory setup with uv
- Finished installing ollama and the models
- Tried to understand why the existing code was written the way it was and in what order I should map out the structure, but ran out of time to get into it

## Reflection

Running `OLLAMA_MAX_LOADED_MODELS=1 ollama serve` loads only one model at a time.

I learned that when working on AI-related projects, people tend to use Python's FastAPI or TypeScript a lot for the backend.

I almost got tempted to invest in local hardware, but I expect you'd need to spend at least 8 million won to get something usable. RunPod seems to be widely used. I want to implement routing on my MacBook and then try running multiple models on RunPod.

I realized I need to get more familiar with Hugging Face.

## Things to study further

- **What criteria does the classifier use to split prompts** — The classifier has to decide whether a prompt goes to reasoning, coding, or vision, and how to make that decision is the core of this project. I need to first check whether the classifier is instructed via a prompt or trained separately
- **The cost of `OLLAMA_MAX_LOADED_MODELS=1`** — Loading only one model at a time saves memory, but it seems like reloading will take time every time the model switches. Since routing means switching models frequently, I need to measure how much this slows things down → [Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.md)
- **Why FastAPI or TypeScript** — I only know that they're widely used, not why. I want to check whether this is related to streaming responses or async handling
- **RunPod's cost structure** — Calculating the break-even point between buying an 8-million-won machine and renting would help me make a decision
- **How to pick models on Hugging Face** — It seems like even the same model can come in different sizes depending on quantization level, and I don't know the criteria for picking one that fits the 5GB constraint → [Hugging Face: Models](https://huggingface.co/docs/hub/models-the-hub)