---
title: "Claude API Doesn't Remember — Maintaining Context in Multi-Turn Conversations"
description: "The API is stateless. You need to accumulate assistant messages in the messages array for the chatbot to remember the previous conversation. I confirmed this through a direct comparison experiment."
pubDatetime: 2026-05-05T13:30:00Z
tags:
  - claude-api
  - llm
  - 학습
draft: false
featured: false
---

While building a simple chat system with the Claude API, I ran into the question "why doesn't the model remember the previous conversation?" and worked through it directly.

## Table of contents

## Experiment design

I ran the same conversation flow in two different ways.

- **Method A — Accumulating history**: Every turn, both user and assistant messages accumulate in the `messages` array sent to the API
- **Method B — New array every time**: Every turn, a new `messages` array is created and sent (containing only the most recent user message)

The conversation scenario is identical in both cases.

```
You: 안녕. 내 이름은 박효인이야.
Claude: 안녕하세요, 박효인님!
You: 내 이름이 뭐였는지 기억나?
```

## Results

### Method A — remembers correctly

![chat.py 실행 결과: 이름을 다시 물어보자 "박효인님"이라고 정확히 답함](/assets/posts/claude-api-multi-turn-context/01-with-history-remembers.png)

> Claude: 네, 기억합니다! 당신의 이름은 **박효인**님이십니다. 대화 시작할 때 말씀해주셨어요. 😊

### Method B — doesn't remember at all

![chat_no_history.py 실행 결과: "이전 대화 내용을 기억하지 못합니다"라고 답함](/assets/posts/claude-api-multi-turn-context/02-without-history-forgets.png)

> Claude: 죄송하지만 저는 이전 대화 내용을 기억하지 못합니다. 저는 각각의 새로운 대화를 독립적으로 처리하기 때문에, 과거 대화에서 나눈 정보(이름 포함)를 기억할 수 없습니다.

Same model, same prompt, but the results are the exact opposite.

## The key point — the Claude API is stateless

The API itself has no concept of a "session." Every request is independent. The reason the model *appears* to "remember" the previous conversation is that **the client (my code) resends the entire past message history along with every request.**

In other words, the model isn't remembering anything — **I'm the one re-informing it of the past every single time.**

```python
# Method A — accumulating
messages = []
while True:
    user_input = input("You: ")
    messages.append({"role": "user", "content": user_input})
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        messages=messages,
    )
    assistant_text = response.content[0].text
    messages.append({"role": "assistant", "content": assistant_text})
    print(f"Claude: {assistant_text}")
```

The key line is `messages.append({"role": "assistant", ...})`. Because the assistant's response is put back into the input array for the next turn, the model is essentially re-reading "here's what I said before" from scratch every time.

## Additional things I noticed during the experiment

### 1. Input tokens get more expensive with every turn

As the conversation gets longer, the `messages` array grows, and the number of tokens sent with each request accumulates. In a 100-turn conversation, the 100th request resends **all** of the user/assistant text from the previous 99 turns. In effect, cost explodes in proportion to conversation length.

→ **Context management is necessary.** You can't just accumulate indefinitely — at some point you need to compress or truncate. This is a separate topic to study.

### 2. Response tone differs noticeably depending on whether a system prompt is present

When I specified a persona/rules in the `system` parameter versus when I didn't, the model's response style changed noticeably. My impression is that the system prompt isn't just a simple "personality setting" — it's a powerful lever that changes the very starting point of the response.

## What to study further

This experiment helped me understand how multi-turn behavior works, but there are several next-level topics I'll run into in practice.

### 1. Context window and token management

- Claude's context window limits (vary by model)
- Strategies for when a conversation approaches the limit: truncating old messages / summarization / sliding window
- How to estimate token usage in advance — the Anthropic SDK's token counting API
- Reference: [Anthropic Docs — Building with Claude](https://docs.claude.com/)

### 2. Prompt caching — the key technique for reducing cost

Marking long system prompts or accumulating message history as **cached** can significantly cut token costs on subsequent requests that reuse the same prefix.

- How to use the `cache_control` marker
- Message arrangement strategies to raise the cache hit rate (stable parts first, variable parts later)
- Cost/latency changes when applied to a multi-turn chatbot
- Reference: the Prompt Caching section of the official Anthropic docs

### 3. System prompt design

- The role of the `system` parameter — how it differs from user messages
- How to separate persona / task instructions / output format rules within a single system prompt
- Whether few-shot examples are better placed in the system prompt or as user/assistant pairs

### 4. Other ways to build stateful conversations

- Storing conversation logs in external storage (DB / file) and restoring them into the messages array when the user returns
- Agent patterns with "memory" — extracting only important facts into separate memory and injecting them into the system prompt
- Using higher-level features like Anthropic's Memory tool or Files API

### 5. Things to compare directly

- How response quality changes as the conversation in **Method A** gets longer (attention distribution over long context)
- The difference in response when giving the same instruction via a system prompt vs. the first user message
- Comparing token cost, latency, and quality across model versions (Opus / Sonnet / Haiku) for the same input

## Reflection

Saying "the model doesn't remember" isn't quite accurate. More precisely, **state isn't preserved between API calls**. The responsibility for remembering lies with the client, not the model — and how efficiently you shoulder that responsibility (context management, caching, external memory) seems to be at the core of LLM application design.

My next experiment is to measure how much prompt caching can reduce the cost of this same chat system.