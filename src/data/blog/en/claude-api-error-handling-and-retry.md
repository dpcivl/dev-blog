---
title: "Claude API Error Handling and Retry — Distinguishing Transient, Permanent, and Format Errors + Exponential Backoff"
description: "What errors should I handle, and how, to build a reliable LLM service? I classify errors into transient / permanent / user input / response format categories, and practice through 4 stages: basic try-except wrapper → Exponential backoff → Anthropic SDK built-in retry → JSON response validation."
pubDatetime: 2026-06-19T00:30:00Z
tags:
  - claude-api
  - llm
  - 에러핸들링
  - 재시도
  - 학습
draft: false
featured: false
---

What I learned today is **error handling + retry.** This is the very first piece of infrastructure you need to lay down to run a reliable, accurate LLM service.

## Table of contents

## 1. LLM API errors fall into 4 categories

Not all errors I have to handle are the same. Since **cause → response method** differs, I need to classify them first.

### Transient errors — resolved by retrying

| Error | Meaning |
|---|---|
| **RateLimitError (429)** | Calling too fast. Retry after a moment |
| **APIConnectionError** | Temporary network disconnection |
| **APITimeoutError** | Response took too long |
| **InternalServerError (500)** | Temporary problem on Anthropic's servers |

→ **Worth retrying.**

### Permanent errors — retrying is pointless

| Error | Meaning |
|---|---|
| **AuthenticationError (401)** | Wrong API key |
| **PermissionDeniedError (403)** | No permission |
| **BadRequestError (400)** | Malformed request |
| **NotFoundError (404)** | Wrong model name |

→ **Code / config needs fixing.** Retrying is a waste of time.

### Related to user input

- Input tokens **exceed the context window**
- **Blocked** due to unsafe content

→ Validate on the input side / ask the user again.

### Related to response format (the LLM's own issue)

- Asked for JSON but got something that isn't JSON
- Tool call arguments don't match the schema
- Response gets truncated (hits `max_tokens`)

→ **Not technically an error, but the format is off.** Needs extra validation + retry.

## 2. Which errors am I responsible for handling

| Category | Responsibility |
|---|---|
| Permanent errors | Almost always **my code's fault** — fix from the start |
| User input related | Input validation / UX handling |
| **Transient errors** | Handling these well is what makes stable operation possible ✅ |
| **Response format related** | Handling these well is what makes stable operation possible ✅ |

In other words, **transient errors + response format issues** are my responsibility. I learned how to deal with these two through a 4-stage example.

## 3. Stage 1 — Basic try-except wrapper

[`error_handling.py`](https://github.com/dpcivl/ai-study-week1/blob/main/error_handling.py)

In practice, you create a **wrapper function** that wraps the API call. You attach an `except` for each error you might encounter and handle it:

- **Transient errors** → sent to the retry logic
- **Permanent errors** → **print exactly what kind of error occurred** so the code can be fixed easily

![Output showing branching by error type using a basic try-except wrapper](/assets/posts/claude-api-error-handling-and-retry/01-basic-error-handling.png)

The key point is: **"never leave it ambiguous what error occurred."** Not being able to debug is the biggest cost.

## 4. Stage 2 — Exponential Backoff retry

[`retry_backoff.py`](https://github.com/dpcivl/ai-study-week1/blob/main/retry_backoff.py)

For transient errors, this is the **retry pattern**. You shouldn't just retry immediately — if many clients retry at the same moment, it can cause even more load (the "thundering herd" problem).

The solution:

1. **Increase the wait time exponentially based on the number of attempts** (1s → 2s → 4s → 8s ...)
2. **Add jitter (noise)** to spread out the retry timing

This is called the **Exponential Backoff with Jitter** pattern.

![Output showing retry intervals getting progressively longer with the exponential backoff pattern](/assets/posts/claude-api-error-handling-and-retry/02-retry-backoff.png)

> This pattern isn't limited to LLM APIs — it's the **standard for all external API calls.** AWS SDK, Google Cloud SDK, and others all use this pattern too.

## 5. Stage 3 — What the Anthropic SDK handles for you

[`sdk_retry.py`](https://github.com/dpcivl/ai-study-week1/blob/main/sdk_retry.py)

You can write manual retry code, but **the Anthropic SDK retries by default.**

- Transient errors are automatically retried by the SDK
- Permanent errors are **not retried** (since it wouldn't be meaningful)
- The **exponential backoff** built above is also automatically applied

In other words, for simple calls or standard error handling, **you can just leave it to the SDK.**

There are still cases where manual retry logic is needed:

- **Special retry logic** (e.g., retrying after changing the model or modifying the prompt)
- **Extra actions between retries** (logging, alerts, notifying users)
- **Different handling after N retries** (fallback response, returning a cached response, etc.)

For these cases, you need to write it manually.

## 6. Stage 4 — JSON response validation (handling LLM format violations)

[`response_validation.py`](https://github.com/dpcivl/ai-study-week1/blob/main/response_validation.py)

The last case is when it's **not technically an error, but the LLM violates the format.** When you asked for a JSON response but got a different format, how do you track it and trigger a retry?

The validation logic I built:

1. **Extract only the JSON portion from the LLM's response**
2. **Check that all required fields are present**
3. **Check that each field's type is correct**
4. **Check that values fall within a predictable range**
5. If everything passes, return `(True, data)`, and on the output side, extract just the key values and display them clearly

![Result of extracting and displaying key values after JSON response validation passed](/assets/posts/claude-api-error-handling-and-retry/03-response-validation.png)

This time it **passed on the first attempt**, but if the response had come back in the wrong format or with out-of-range values, it would have **automatically retried.**

> This pattern is a step you must go through before passing LLM output on to downstream systems (DB, API, another LLM call). A single format violation can break the entire system downstream.

## Retrospective

After going through the 4-stage error handling + retry example, here's what I think:

**To build a reliable, accurate LLM service, this infrastructure is what you need first.** Making sure responses arrive consistently, no matter the situation, comes before making the model smarter.

What I found particularly interesting was the sense of **"controlling the responses for the service I'm building."** When an LLM response violates the format, instead of just accepting it as-is, you run it through a **validation-and-retry cycle that forces it to conform to the schema I defined.** I think this is what "integrating an LLM into code" really means.

## Things to study further

### 1. The Anthropic SDK's exact retry policy

- Default `max_retries` value (for the Python SDK)
- The exact list of which status codes are retried
- Customizing retry count via `client.with_options(max_retries=N)`
- [Anthropic SDK errors and retries official docs](https://docs.anthropic.com/en/api/errors)

### 2. Types of jitter — Full / Equal / Decorrelated

- **Full jitter**: `sleep = random(0, base * 2^attempt)`
- **Equal jitter**: `sleep = base * 2^attempt / 2 + random(0, base * 2^attempt / 2)`
- **Decorrelated jitter**: recalculated based on the previous sleep value
- AWS's official blog post ["Exponential Backoff And Jitter"](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) is the standard reference

### 3. Safer ways to force JSON responses

- Just telling it "answer in JSON" via prompt is a weak guarantee
- **JSON mode / structured output** — some models can enforce a schema
- Using **Tool Use's input_schema** for response validation
- **Pydantic + the Instructor library** — practically the standard in Python

### 4. Circuit Breaker pattern

- After a certain number of consecutive failures, **block calls entirely for a period of time**
- Prevents the caller from wasting time/money on infinite retries
- A pattern that's used alongside retry
- Netflix Hystrix, Resilience4j, etc. are well-known implementations

### 5. A retry strategy that factors in cost

- Every retry uses tokens = costs money
- The decision of "is this error worth retrying?"
- UX for notifying the user that a "retry is in progress"
- Fallback response on final failure (cache / static response / cheaper model)