---
title: "Organizing UI Vocabulary for Vibe Coding — State, Motion, Hierarchy, and Copy"
description: "When you get AI to build UI, vague words like 'make it pretty' or 'make it smooth' don't work. My first terminology post, where I organize vocabulary across three axes — state, motion, and hierarchy. Includes a playground link at the end you can try out yourself."
pubDatetime: 2026-06-15T00:00:00Z
tags:
  - UI
  - 바이브코딩
  - 용어정리
  - 프론트엔드
  - 학습
draft: false
featured: false
---

Every time I touched up UI while vibe coding, I kept saying "this isn't it..." and revisions kept piling up endlessly. The cause was clear. **I couldn't describe what I wanted using precise vocabulary.**

When you instruct with things like "make the button pretty" or "make the screen transition smoothly," the AI builds its own interpretation of "pretty" and "smooth." If you're lucky it lands in one shot, but most of the time it takes two or three more rounds of back-and-forth. It's faster to **instruct with precise vocabulary from the start**.

So this is the first post in a terminology series I'm starting. The UI edition.

> 📍 I made a separate page so you can directly try out the UI elements covered in this post — the link is at the end.

## Table of contents

## Two tools for instructing UI with words

Digging deeper, it really comes down to two things.

1. **Descriptive vocabulary** — precisely describing UI using concept-words like state / time / acceleration
2. **The habit of giving references** — presenting the UI of a similar service as a reference point

This post focuses on #1. That vocabulary further splits into **four areas**.

| Area | Core vocabulary | Depth needed? |
|---|---|---|
| **Components & state** | button, input, card, modal / default, hover, active, disabled, loading, focus | 🔴 Deep |
| **Motion** | property, duration, easing | 🔴 Deep |
| **Shape** | hierarchy, typography, color, spacing | 🟡 Moderate (faster to fix after seeing the AI's output) |
| **Copy** | button text, error messages, empty states | 🟢 Faster to just specify it yourself than to build vocabulary |

The areas that need the deepest work are **components & state** and **motion**.

## Chapter 1. Components and State — Approach via "state," not "shape"

There are many components in a UI. Among them, **the button is a microcosm of every component**. Once you know how to write a proper button prompt, everything else is the same thinking applied elsewhere.

To make a well-finished button, you need to **focus on "state," not "shape."**

### The button's five states

| State | Name | When | Visual cue |
|---|---|---|---|
| Normal | `default` | When nothing is happening | Base appearance |
| Mouse over | `hover` | When the cursor is over it | Slightly darkens or changes color |
| Pressed | `active` (pressed) | The moment it's pressed | A pressed feeling (slightly smaller or darker) |
| Disabled | `disabled` | When it can't be pressed | Faded out, cursor blocked too |
| Loading | `loading` | While a request is processing | Spinner + lock |

In particular, whether **hover** and **loading** exist is what separates a "finished button" from a "flat button."

### Instruction comparison

- ❌ "Make me a login button."
- ✅ "Make me a login button. Have it **darken slightly on hover**, shrink slightly and feel pressed when clicked, and while the login request is processing, show a spinner inside the button and make it **disabled**."

### Approach other components the same way, via "state"

- **input**: default / **focus** (clicked and being typed into — usually an emphasized border) / **error** (red border + message) / **filled** (has content) / disabled
- **card**: default / hover (slightly lifts or emphasizes the border) / **selected**
- **modal**: a popup that appears in the center. **The transition when it appears / disappears** is the key part (→ Chapter 2)
- **toast**: a notification that appears briefly and disappears. Give timing along with it, like "**disappear automatically after 3 seconds**"
- **tooltip**: a small explanation that appears on hover

## Chapter 2. Motion — Three Choices

The essence of what shapes motion actually boils down to **three choices**.

### First — what moves (property)

| property | effect |
|---|---|
| `opacity` (transparency) | Changing 0→1 fades it in gradually, and the reverse fades it out |
| `transform: translate` (position) | Changing position slides it |
| `scale` (size) | Changing small→large makes it pop up like an expansion |

Usually you mix two. Combining **"opacity + position"** gives you the commonly seen **"rising up from below while appearing"** effect.

### Second — how long (duration)

| Time | Feel | Where to use it |
|---|---|---|
| 0.15 ~ 0.2 sec | Immediate | Button feedback, small interactions |
| Around 0.3 sec | Natural | **Default for screen transitions** |
| 0.5 sec or more | Leisurely, elegant | When you want to intentionally show something slowly |

### Third — what kind of acceleration (easing / timing function)

| easing | curve | where to use it |
|---|---|---|
| `linear` (constant speed) | Constant speed, mechanical | Rarely used |
| `ease-in` (starts slow) | Slow start | Elements that disappear |
| `ease-out` (ends slow) | Slow arrival | **Most natural for elements appearing** |
| `ease-in-out` (slow at both ends) | Smooth movement | Position changes |
| `bounce` / `overshoot` | Slight bounce at the end | Playful, bouncy feel |

### Instruction comparison

- ❌ "Make the card appear smoothly"
- ✅ "Make the card appear **rising up gently from below, over 0.3 seconds, with an acceleration that slows down at the end (ease-out)**"

## Chapter 3. Shape — The Key Is "Hierarchy"

In the shape section, the most important thing is **hierarchy**. It's about signaling "what matters most on this screen."

- **Button hierarchy**: the most important button gets a full solid color (**primary**), less important ones get just an outline (**secondary** / **ghost**), and dangerous actions get red (**danger**)
- **Typography**: size (`font-size`), weight (`font-weight`), line spacing (`line-height`)
- **Color**: one primary color plus semantic colors (success / warning / danger) is usually enough
- **Spacing/alignment**: uniform spacing, alignment baselines

For this area, it's **faster to look at the AI's output and adjust as you go** rather than memorizing everything up front.

## Chapter 4. Copy — A Small Area, But It Shapes the Impression

This part is actually UI too. Whether a button says "Confirm" or "Save Record," whether an error says "An error occurred" or "Please check your email format."

Since AI tends to insert awkward phrasing by default, **it's faster to specify the copy yourself**.

- **Button copy**: use verbs with a clear action ("Save Record" rather than just "Save")
- **Error messages**: state what went wrong and how to fix it — guide the user, don't blame them
- **Empty states**: a single line that prompts action when there's no data

## A Playground to Try It Yourself

> 🎮 **[UI terminology playground](/playground/ui-terms/)** — I built this so you can hover and click through the button states / animations / easing / component transitions covered above.

Checking concepts you've only read about **with your eyes and hands** makes the vocabulary become your own much faster. That sense will help the next time you're instructing an AI.

## Further Study

### 1. Tailwind CSS / Material Design / Apple HIG vocabulary

- Tailwind already has all the above vocabulary as classes (`hover:`, `active:`, `disabled:`, `transition-`, `ease-out`...)
- Material Design's elevation and motion guides
- Apple Human Interface Guidelines' recommended transition values
- Good way to confirm that every design system uses the same concept-words

### 2. Deep-diving into CSS Animation / Web Animations API

- The difference between `@keyframes` and `transition` / when to use which
- JS's `Element.animate()` and `requestAnimationFrame`
- What you need to animate to avoid breaking 60fps (transform / opacity are GPU-accelerated, layout properties are heavy)

### 3. The math behind easing curves

- Defining `cubic-bezier(x1, y1, x2, y2)` yourself
- Getting a feel for it with tools like [cubic-bezier.com](https://cubic-bezier.com)
- Spring physics-based animation (Framer Motion, etc.)

### 4. Researching design systems and component libraries

- Shadcn UI, Radix UI, Headless UI — for learning state management patterns
- Reading through code to see how a single component expresses five different states via props

### 5. Next terminology series

- Database terminology (normalization, indexes, transactions, isolation levels)
- Authentication/authorization (OAuth, OIDC, JWT — yesterday's KakaoTalk login post is the starting point)
- Backend architecture (REST, gRPC, event-driven)
- Once the series builds up, it becomes my own standard vocabulary reference

## Retrospective

In vibe coding, **my role isn't the typist — it's the judge.** In an era where AI can churn out code fast, what I need to do is **instruct precisely and judge precisely**. Vocabulary is the tool for that.

Something I reconfirmed while putting this together: **memorizing concepts alone doesn't make you good at instructing — it's when actual hands-on experience connects with the vocabulary** that it finally comes out of your mouth naturally. That's why I built the playground alongside this post. Going forward, I plan to continue the series with this pattern — post + hands-on page — every time I encounter a new term.