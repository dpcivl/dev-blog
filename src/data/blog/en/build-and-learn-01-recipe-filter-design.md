---
title: "Learning by Building #1 — What I Missed in Designing an Ingredient-Filtered Recipe Feature"
description: "A feature where you input a recipe plus 'the ingredients I have', and it returns a cooking method that works with just those ingredients. Before implementing, I answered the design questions myself and got them evaluated. What I got right, 5 things I got wrong, 6 things I missed — name tags instead of indexes, revealing instead of blocking, combinatorial explosion, and the trap of AI-written tests."
pubDatetime: 2026-07-29T04:25:00Z
tags:
  - 학습
  - 설계
  - 회고
  - AI
draft: false
featured: false
---

I'm building features one at a time and writing down what I learn while implementing them. This is the first entry in that record.

The feature I'm building this time is this:

> **A function that takes a recipe and "the list of ingredients I have," and returns a cooking method that works with just those ingredients.**

If there's an egg-roll recipe but no carrots, it returns a cooking method that still makes sense without the carrots. Before starting implementation, I **wrote down my own answers** to a few design questions first, then had those answers evaluated. To summarize the results — I got far more things **wrong or missed** than right. That's the core of this post.

## Table of contents

## The design questions I answered myself

First, I wrote down my own answers to questions like these.

- How do I write a recipe into a file? → A list of required ingredients + nice-to-have ingredients
- What does the function take in and return? → Takes (recipe, ingredients I have), returns a cooking method
- How do I distinguish "just missing carrots" from "missing carrots and chives"? → By whether it's in the ingredients-I-have list or not
- What if you uncheck a required ingredient (egg)? → Force egg to always be included, no unchecking allowed
- What about cooking steps that disappear when an ingredient is missing? → Transform with an LLM, or register a separate recipe for each combination
- How do I verify it works? → Click through it myself, and ask AI to write test cases

Below is the evaluation of these answers.

## What I got right

- **The input/output direction was correct.** "Takes (recipe + ingredients I have) and returns a cooking method." That's exactly what the actual design is.
- **The distinction method was also correct.** I wrote, somewhat unconfidently, "can't I just check whether it's in the list or not??" — and that's the answer. If carrots aren't in the ingredients-I-have list, they're missing. There was nothing more complicated to it, but I second-guessed myself for no reason.
- **I had already written the definition of this feature myself.** "Not just removing the items where the ingredient appears, but creating a **valid** recipe when the ingredient is missing." This one sentence is the core of this feature.
- **The most valuable answer:** "Verify that the transformed recipe is actually a recipe you can make that way." I precisely identified the exact kind of failure that code tests can never catch.

## 5 things I got wrong

### 1. Never refer to ingredients by 'index'

If you refer to ingredients by order number, it breaks like this:

```text
Now:   0=egg  1=cooking oil  2=salt  3=carrot  4=chive
Someone shares a link: "Egg roll with ingredient #3 removed"   ← the carrot-free version

A month later, while cleaning up the ingredient list, salt gets moved to the end
After:   0=egg  1=cooking oil  2=carrot  3=chive  4=salt
That same link: "Egg roll with ingredient #3 removed"   ← now opens the chive-free version
```

The person who receives the link has no idea anything changed. The screen looks fine, there's no error. They just see a **different dish**.

→ Give each ingredient a **meaningful name tag**. `carrot`, `chive`. No matter how you reorder things, `carrot` is still carrot. And once a name tag is used, don't reuse it for a different ingredient.

### 2. Don't 'block' unchecking a required ingredient, even for required ones

I wanted to prevent unchecking the egg. But this loses something. **The rate at which you hit "can't be made without this ingredient"** is a signal for whether the required-ingredient rule is too strict. If you block unchecking the egg, this number stays at zero forever, and you lose any way of knowing whether you mistakenly made salt a required ingredient.

→ Let it be unchecked, and **show "Can't be made with these ingredients."** It's not about blocking; it's about being honest. (Though if what I meant was "mark each ingredient as required or not," that part was correct.)

### 3. Use the LLM at 'authoring time,' not 'request time'

I said I'd use the LLM to transform the disappearing step, but the timing was wrong.

| | Request time (when the user unchecks) | Authoring time (once, during development) |
|---|---|---|
| When | Every time | Once |
| Result | Different every time | Fixed, saved to a file |
| Verification | Impossible (the sentence doesn't exist yet) | A person reads it, fixes it, and commits it |
| If wrong | The user ruins their food | Caught before commit |

Generating at request time breaks in practice, too. Open the same checkbox combination twice, get a different cooking method both times → **there's no expected value, so you can't write tests.** You can't find yesterday's recipe again today.

→ Use the LLM, but **only as a drafting tool during development.** A person edits the generated sentence and locks it into a file, and what the user sees is always that fixed sentence.

### 4. Registering a recipe 'whole' for every combination explodes

If you register the cooking method whole for every combination:

```text
3 optional ingredients (salt, carrot, chive)  →  8 versions
4 optional ingredients                        →  16 versions
5 optional ingredients                        →  32 versions
5 recipes = 80 versions. At 18 minutes per version...
```

→ Instead of whole recipes, attach **substitute sentences per step**.

```text
2. Finely julienne the carrot and chive.
     ├ No carrot   →  "Finely julienne the chive"
     ├ No chive    →  "Finely julienne the carrot"
     └ Neither     →  Delete this step
```

Not 8 versions — **3 sentences.** And these 3 sentences are used as-is whether or not there's salt — salt is unrelated to this step. This is how you avoid combinatorial explosion.

### 5. AI-written tests have a trap

I said "I'll ask AI to write tests," but AI writes tests **by looking at the implemented code.** So it writes tests **that pass even when the code is wrong.** If the code is incorrectly written as "delete step 2 if there's no carrot," AI will write a test that "checks whether step 2 is deleted," and it'll pass. The user moves on to the next step without any ingredient left to julienne.

> The mere fact that a test passes doesn't tell you whether the code is correct or whether the test is weak.

→ Block this two ways. ① **Decide the list of test cases before implementation** (so it doesn't get shaped around the code). ② **Deliberately break the code** — if you remove the required-ingredient check and all the tests still pass, that test isn't protecting anything.

## 6 things I missed

### 1. Where to put the cooking 'sentences' (data shape)

I only answered about the ingredient list. But what this feature actually reuses is the **sentences (the cooking steps).** Ingredients are just the condition for selecting those sentences. I missed half the data.

### 2. The output also needs to include the 'ingredient list'

If you only return the cooking method, it goes out of sync like this:

```text
[Ingredients]  3 eggs · cooking oil · salt · 1/4 carrot · a little chive   ← the carrot is still listed
[Method]
1. Beat 3 eggs in a bowl and add a pinch of salt.
2. Finely julienne the chive.                          ← but the carrot step is gone
```

If you calculate the body text and the ingredient list separately, they will inevitably drift apart. You need to **generate them together at once** and return them.

### 3. The function must not modify the original recipe

I said "the function is called every time you toggle a checkbox," but if the function directly modifies the original:

```text
Uncheck carrot     → Step 2 changes to "Finely julienne the chive" (original is gone)
Recheck carrot     → No original left, so "Julienne the carrot and..." can't be restored
                   → The screen keeps showing "Finely julienne the chive"
```

The more you toggle checkboxes on and off, the more the recipe gets whittled away, with no way back. → The function should **only read the original and produce a new result.**

### 4. Who wins when there are multiple candidates

I had sentences prepared for "no carrot," "no chive," and "neither," but the user turned off both.

```text
No carrot version   "Finely julienne the chive"     ← seems right, since there's no carrot
No chive version    "Finely julienne the carrot"    ← also seems right, since there's no chive
Neither version     (delete this step)              ← this is also correct
```

All three conditions match. Without a tiebreaker rule, the computer picks the first one and outputs **"Finely julienne the chive"** — even though there's no chive. The screen looks fine, no error, and only the user notices the missing chive.

→ **The more specific condition wins.** "When neither is present" references 2 ingredients, and "when carrot is missing" references 1. The one that references more is more specific. (Bonus: if you don't write a "neither" sentence, the two single-ingredient ones tie → a tie is proof that the author never wrote a sentence for that combination, and gets caught before commit.)

### 5. Ghost references — steps with no ingredient name in them

Turn off both carrot and chive, and step 2 disappears. But what about step 3?

```text
2. Finely julienne the carrot and chive.     ← disappears
3. Mix the julienned vegetables into the beaten egg.    ← still there. Where does "julienned vegetables" come from?
```

Step 3 doesn't mention any ingredient name at all. So a check like "did a missing ingredient's name stay in the text" wouldn't catch this either. The dependency isn't on the ingredient — it's on **the output of a previous step.** This was the most invisible trap. → **Record in the data that "step 3 depends on step 2 existing."**

### 6. You can't click through everything by hand

```text
3 optional ingredients → 8 combinations to check   → 5 recipes = 40 checks
5 optional ingredients → 32 combinations to check  → 5 recipes = 160 checks
```

You can't click 160 times for every single fix. Check a few by hand, and make the rest **run automatically.**

## Summary

| Question | Verdict |
|---|---|
| Data shape | Half right — ingredients correct, **sentences missing** |
| Input/output | Correct — but missing: including the ingredient list in output, not modifying the original |
| Distinction method | Correct — but missing: **who wins when there are multiple candidates** |
| Required ingredients | Half right — explicit marking correct, index/block-unchecking wrong |
| Disappearing steps | LLM timing wrong / "register separately" was the wrong unit / ghost references missed |
| Verification | Direction correct — missing the AI-test trap and the need for automation |

## Reflection

Honestly, **there weren't many new concepts I learned.** Name tags over indexes, treating data as immutable, avoiding combinatorial explosion — most of these are things I'd heard before somewhere. The problem was that **I got the answers wrong because I didn't know how to apply what I already knew to this specific feature right now.**

So the value of this record isn't "I learned something I didn't know" — it's that **it precisely exposed the spots where I hadn't managed to apply what I already knew to an actual design.** If I hadn't written down my own answers before implementing, all 11 of these would have come to light only after I'd finished writing all the code — or when the user went looking for chives that weren't there.

## To dig into further

- **The most specific rule wins (specificity)** — a familiar concept from CSS selector precedence or pattern matching. How far does this generalize — "the condition that matches on more counts wins"?
- **Treating data as immutable** — the pattern of creating a new result instead of modifying the original. The undo problem with checkbox toggles is actually solved by this one thing.
- **Mutation testing** — the formal name for "deliberately break the code and see if the tests catch it." A method for verifying whether tests are actually protecting anything.
- **Authoring time vs. request time** — the tradeoff between using the LLM at build time and fixing the result, versus generating it fresh every time at runtime. Evaluated on reproducibility and verifiability.