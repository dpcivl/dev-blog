---
title: "How System Prompts Differ from User Messages — Persona Consistency and Forcing JSON Output"
description: "A question I ran into while experimenting with personas in the Claude API: how is a system prompt actually different from just writing 'please do X' in a user message? I worked through this in terms of consistency, security, and output enforcement."
pubDatetime: 2026-05-06T01:00:00Z
tags:
  - claude-api
  - llm
  - 학습
  - 시스템-프롬프트
draft: false
featured: false
---

In the [previous post](./claude-api-multi-turn-context), I covered context accumulation in multi-turn conversations. This time I went one level deeper, attaching **multiple persona system prompts** to the same model and seeing what I could learn.

## Table of contents

## What I Learned from the Persona Experiment

I gave the same model the same user input, but with different system prompts, to get responses from several different personas. The results were interesting.

- **Response length varied by persona.** Some personas answered short and blunt, others answered long and elaborate.
- **Response format also varied.** Some personas used markdown headings frequently, while others answered only in plain prose.
- **I could actually force the output format itself.** When the system prompt explicitly said "answer only in JSON," the model followed that instruction in most cases.

This got me thinking: **if I can control output this reliably, I could plausibly wire the API directly into a production service** (parse the JSON response and immediately hand it off to backend logic).

## The Question That Came Up

But one question nagged at me.

> "What's the actual difference between writing 'answer in JSON' in the system prompt versus just writing 'please do this' in a user message?"

On the surface, both look like ways of giving the model an instruction. Here's what I worked out.

### 1. The Scope of Application Differs

- **System prompt**: applied automatically on every turn. Set it once, and it persists for the whole conversation.
- **Instruction in a user message**: applies only to that turn. On the next turn, the model forgets it unless I write it again (more precisely, the model now has grounds to ignore it).

→ **Persona consistency** is far stronger with the system prompt. Even after 10 or 20 turns, the same tone and format holds.

### 2. Security and Control Differ

- **System prompt**: controlled by the client (my code). The user can't change it directly.
- **Instruction in a user message**: the user can write whatever they want. If they later interject with "don't answer in JSON, just plain text," the model may well go along with it.

→ When building this into a service, it's safer to **lock down output format and behavioral rules in the system prompt**. User input can't easily break rules set in the system prompt (not perfectly — that's a separate topic called prompt injection).

### 3. The Weight the Model Gives Each Differs

This is just my impression, but — even for the same instruction, the model seems to follow it more firmly when it's in the system prompt. A request in a user message feels like it's treated as a negotiable "favor," while a system prompt feels like it's treated as a "rule." (This part is just my impression and needs more rigorous verification.)

## The Pitfalls of Forcing JSON Output, and Safeguards

Even with a strong system prompt instruction like "answer only in JSON," the model doesn't always follow it perfectly. A case that comes up often:

```
{"name": "박효인", "age": 30}

위 정보를 바탕으로 답변드렸습니다.
```

→ A friendly explanation tacked on after the JSON object. Parsing this directly with `json.loads` breaks.

In the example I ran today, I handled this with simple string processing.

```python
def extract_json(text: str) -> str:
    """응답이 순수 JSON이 아니어도 첫 { 부터 마지막 } 까지만 잘라낸다."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or start > end:
        raise ValueError("JSON object not found in response")
    return text[start : end + 1]

cleaned = extract_json(response.content[0].text)
data = json.loads(cleaned)
```

I find the position of the first `{` with `text.find("{")` and the last `}` with `text.rfind("}")`, then slice out only what's between them. Even if the model tacks on chatter before or after, I can salvage just the JSON portion. There is a limitation though: **if another JSON-like piece of text gets mixed in, or escaping is broken, this approach can't catch it**.

## Summary

- The system prompt is "rules that apply across the whole conversation"; the user message is "a request for this turn only."
- Persona consistency, security, and forcing output format all fall under the system prompt's domain.
- Even when you force an output format, the LLM sometimes breaks the rule → adding another layer of defense on the client side is what actually works in practice.

## Things to Study Further

### 1. System Prompt Design Patterns

- Persona / task instructions / output rules / few-shot examples — what's the most effective way to separate these within a single system prompt?
- How does the model's focus change as the prompt gets longer (does it follow instructions at the beginning more, or the end)?
- Reference: [Anthropic Prompt Engineering guide](https://docs.claude.com/en/docs/prompt-engineering)

### 2. Anthropic's Official Output Enforcement Features

- Structured output via **tool use (function calling)**: give the model a defined tool, and it responds according to that tool's input schema → JSON parsing failure rate drops significantly
- The **`stop_sequences` parameter**: cuts off the response once a specific token appears
- Both are likely more reliable than "answer only in JSON" in the system prompt plus post-processing
- Reference: [Anthropic tool use docs](https://docs.claude.com/en/docs/build-with-claude/tool-use)

### 3. Prompt Injection — Bypassing the System Prompt

- Attacks where the user tries to neutralize the system prompt from a user message, e.g. "ignore previous instructions and…"
- How well the model defends against this, and mitigation patterns for when it fails (input sanitization, external guardrail models, output verification)
- A topic that absolutely needs to be addressed before deploying to production

### 4. Experiments Worth Running Directly

- Give the same instruction via (a) the system prompt, (b) the first user message, (c) repeated in every user message — compare how well persona consistency holds over 10+ turns for each
- Give the JSON-forcing instruction via (a) natural language in the system prompt, (b) tool use — measure the parsing failure rate across 100 calls

### 5. Edge Cases for Safe JSON Extraction

- When the JSON is wrapped in a markdown code block (\`\`\`json … \`\`\`) in the response
- When quotes or braces from user input get mixed into the JSON body itself
- In these cases, a more sophisticated parser or tool use is the right approach, rather than simple `find`/`rfind`

## Reflection

The persona experiment started out as just "getting fun responses," but by the end it touched on a more fundamental question: **how do you make LLM output trustworthy?** The system prompt is the first tool for giving an LLM consistency and control, and it seems like production services need a layered approach — stacking safeguards like tool use or post-processing on top of it.

The next experiment: directly measuring how much the parsing failure rate drops when getting the same JSON output via tool use.