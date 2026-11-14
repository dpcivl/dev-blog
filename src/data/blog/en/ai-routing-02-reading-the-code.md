---
title: "AI Routing #2 — I was talking to a local model using OpenAI API format"
description: "I opened up code I had only set up but never read last time. Tracing it from the pydantic models in types.py to the abstract class in backends, I found out that requests sent to the local ollama were in OpenAI API format."
pubDatetime: 2026-09-22T13:20:00Z
tags:
  - LLM공부
  - ollama
  - 로컬LLM
  - python
  - 학습
draft: false
featured: false
---

In the [previous session](/en/posts/ai-routing-01-local-model-selection), I only got through the uv setup and model installation, and never got to look at the code. Today I tried to see **why** the code I wrote back then was written the way it was. I was curious about what process you go through when implementing LLM model routing.

The code is in the [ai-routing-trial repository](https://github.com/dpcivl/ai-routing-trial).

## Table of contents

## Overall flow

<img src="/assets/mermaid/f895fe8aeb83e90c.svg" alt="User asks a question via ai-router ask, cli interprets the command, config reads models.yaml, then the router determines the category and picks one of reasoning / coding / vision models, and the backend sends an HTTP request to Ollama and returns the response with speed measurements" width="629" height="862" style="max-width:min(100%, 629px);height:auto;" />

The core idea is **the router decides, and the backend executes**.

The details are in [code-walkthrough.md](https://github.com/dpcivl/ai-routing-trial/blob/main/docs/code-walkthrough.md) in the repository. I was going to copy it over as-is, but since anyone can just read that directly, I decided to only write down what I realized while reading it here.

## Reading `types.py`

First, I read `src/ai_router/types.py`.

There's a `Category` class for returning the routing destination, and `UserRequest`, `RouteDecision`, `ChatResult`, and `PipelineResult` all inherit from `BaseModel`.

`BaseModel` is a class provided by pydantic. It's like a struct in C, except **it throws an error if the wrong type comes in.** The difference from a struct is when the check happens. It's checked not at compile time, but when the value actually comes in.

Here's the role of each:

- **`UserRequest`**: The request sent by the user. It checks whether there are images or not
- **`RouteDecision`**: The decision made by the router
- **`ChatResult`**: Lets you quantify the LLM model's performance
- **`PipelineResult`**: Shows the overall result of processing a request

`@property` lets you use a function like a variable. It makes sense when you look at the `if request.has_images:` part in `backends/base.py`. It's a method, but it reads like a value, without parentheses.

`RouteDecision` has members related to the decision the router makes, and I was curious **how the `confidence` value is calculated**.

## `config.py` and `models.yaml`

When configuring models for the router, which model is used for which role is written in `configs/models.yaml`. `config.py` converts that `models.yaml` into a Python object.

The `load_config` function is called from the `main` function in `cli.py` when loading the configuration.

## Looking at the backends

The `backends` directory has `base.py` and `openai_compat.py`.

The ABC I used to use when developing a rain gauge datalogger was here too. The ABC in `base.py` is fleshed out in detail in `openai_compat.py`.

One thing surprised me. **The part that builds the stream used syntax similar to what I used when making examples with the Claude API.** It turns out this is the API format used by OpenAI.

Both Ollama and vLLM use an API similar to OpenAI's. So the format is the same, and it's just that the server runs as an internal ollama server.

## That's it for today

I still haven't opened `routers/`. I know from the flowchart that the router makes the decision, but I haven't seen what that decision looks like in code.

## Things to study further

- **How is `confidence` calculated** — This was the part that bothered me most while reading `RouteDecision`. I don't know what number is used to quantify the router's confidence when it decides "this request is about coding." I think the answer will show up once I open the router code
- **When pydantic checks values, and the cost of it** — If values are checked when they come in, I wonder whether they get checked every single time a request passes through a layer → [Pydantic: Models](https://docs.pydantic.dev/latest/concepts/models/)
- **What exactly does an ABC enforce** — I used this for the rain gauge project too, but I only know it at the level of "if you inherit it, you have to implement it." I want to check exactly when the error occurs if you don't implement it → [Python: abc](https://docs.python.org/3/library/abc.html)
- **How far does Ollama's OpenAI-compatible API support go** — If the format is the same, I want to know whether the backend code stays the same if I switch to vLLM, or whether there are features that don't work → [Ollama: OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/openai.md)
- **What exactly is measured as the speed metric** — At the end of the flowchart there's "response + speed measurement." I wrote that `ChatResult` quantifies performance, but I haven't actually looked at what value is measured yet