---
title: "Building RAG from Scratch — Embedding, Cosine Similarity, Chunk Search (with Korean vs English Comparison)"
description: "Carving out the inside of RAG (Retrieval-Augmented Generation) with actual code, from what embedding even is to debugging suspicious results. I pulled 1536-dimension vectors with OpenAI's text-embedding-3-small, compared them with cosine similarity, compared Korean vs English performance, and worked through chunk splitting. Surprisingly, Korean embedding similarity turned out to be lower."
pubDatetime: 2026-06-19T13:30:00Z
tags:
  - rag
  - llm
  - openai
  - 임베딩
  - semantic-search
  - 학습
draft: false
featured: false
---

Today's topic is **building RAG from scratch**. **R**etrieval-**A**ugmented **G**eneration — in Korean, "검색 증강 생성" (search-augmented generation). Just from the term, I had no idea what it meant. So I built it myself and looked inside.

## Table of contents

## The core idea of RAG

Roughly summarized as a diagram:

![RAG core idea diagram — document embedding + query embedding + retrieval + context injection](/assets/posts/rag-from-scratch-embedding-and-similarity-search/01-rag-concept-1.png)

The core idea is **"retrieve documents the LLM doesn't know about from an external source and feed them in as context."** The unit of that retrieval is a **vector (embedding)** that compresses the meaning of text, and the comparison is done with **cosine similarity**.

## Getting an OpenAI API key — Anthropic has no embedding model

For RAG study, I **issued an OpenAI API key**. I'd already paid for Anthropic tokens, but apparently for embeddings, **OpenAI's `text-embedding-3-small` is the cost-effective standard**.

![OpenAI dashboard — after adding a $5 credit payment, usage at 0](/assets/posts/rag-from-scratch-embedding-and-similarity-search/02-openai-dashboard.png)

- **OpenAI embeddings = market standard** (the most widely used model)
- `text-embedding-3-small`: **$0.02 per 1M tokens**
- Dimensions: 1536

> I'm not sure why, but **Anthropic doesn't build embedding models.** They recommend using external models like Voyage AI or Cohere instead. For this study, I went with OpenAI.

## 1. Starting with what embedding actually is

Code: [`embedding_basic.py`](https://github.com/dpcivl/ai-study-week1/blob/main/embedding_basic.py)

First, I called the API directly just to get a feel for what embedding is. It's simply turning text into a vector.

![Result of converting text into a 1536-dimension vector with text-embedding-3-small](/assets/posts/rag-from-scratch-embedding-and-similarity-search/03-embedding-vector-1536.png)

Each piece of text gets converted into a **1536-dimension vector**.

But at this point, I couldn't see **why** embedding was even necessary. Just turning text into vectors doesn't tell you how similar two pieces of text are. **The next step is the key part.**

## 2. Cosine similarity — how much do two vectors point in the same direction?

Code: [`cosine_similarity.py`](https://github.com/dpcivl/ai-study-week1/blob/main/cosine_similarity.py)

**Cosine similarity** is a way to measure how similar the **direction** two vectors point in is. I think I saw this while studying CNNs, but my memory of it is fuzzy.

- Value range: **-1 to 1**
- **Closer to 1 means more similar**
- **Near 0 means unrelated**
- **Values near -1** rarely show up in text embeddings

### First experiment — suspicious results

![First cosine similarity calculation — suspicious values in the 0.2~0.4 range](/assets/posts/rag-from-scratch-embedding-and-similarity-search/04-cosine-similarity-suspicious.png)

Something's off. **The values look randomly assigned somewhere between 0.2 and 0.4.** They weren't based on similarity at all.

> Thinking "maybe it's a code mistake," I copy-pasted the whole thing and ran it again, but got the same result. **A case with no errors but suspicious results** — this turned out to be a really good learning case. I also suspected it might be a temporary issue with the model's response, but that wasn't it either.

Hypothesis: **embedding a single word alone might not let the model extract meaningful information.** So I moved on to the next example with longer text.

## 3. Semantic search — Korean turns out surprisingly low

Code: [`semantic_search.py`](https://github.com/dpcivl/ai-study-week1/blob/main/semantic_search.py)

I tested with a set of longer mock documents plus a list of questions.

![Semantic search result in Korean — absolute similarity values are low](/assets/posts/rag-from-scratch-embedding-and-similarity-search/05-semantic-search-korean.png)

Still **lower numbers than expected**. This made me question the quality of the answers. Apparently, **a good match is generally around 0.6 to 0.8**. In this result, **the top match was correct, but the 2nd and 3rd were off** + **even the top similarity was under 0.30 to 0.50**.

Possible causes (I noted these down):

1. **All documents were short sentences**, so the semantic information was sparse
2. **Surface-level expression similarity** might be throwing off the actual semantic match
3. It could be **a limitation of Korean embedding itself**

The third one bothered me, so I ran **the same experiment in English**.

### Switching to English

![Semantic search result in English — absolute similarity values are clearly higher than Korean](/assets/posts/rag-from-scratch-embedding-and-similarity-search/06-semantic-search-english.png)

**The absolute similarity values were clearly higher, and the match quality was better too.** The limitation of Korean embedding was real.

### So then — embed in English, respond in Korean — Cross-lingual RAG

The thought naturally followed:

> Wouldn't it make sense for a real service to **embed in English, then translate to Korean for the response**?

Looking into it, this pattern already exists: **Translation-based Retrieval**, or **Cross-lingual RAG**.

| | Pros | Cons |
|---|---|---|
| English embedding + Korean translation | Higher embedding quality | **5x increase in latency** (two translations + embedding) |
| Korean-specific embedding (KoSimCSE, etc.) | Lower latency | Trade-off in model quality + dimensions / hosting cost |

The operating cost itself doesn't increase as much as I expected, but the **5x latency** is the real blocker. I figured it would be **better to just try a Korean-specific embedding model separately** instead.

> Additional observation: it seems like there's a tendency for the model to mark something as more similar just because keywords happen to match. That said, for **longer documents**, I'd expect context-based matching to kick in, so retrieval should work better.

## 4. Chunk splitting — why it's necessary

Code: [`chunk_search.py`](https://github.com/dpcivl/ai-study-week1/blob/main/chunk_search.py)

In practice, documents are long. A whole book, an entire paper PDF, a whole codebase. **If you embed the whole thing at once, the meaning gets blurred.**

### Intuition — what happens if you embed an entire book on embedded systems?

The average of each chapter ends up landing somewhere around "embedded development" in general. So even if you ask **"When should I introduce an RTOS?"**, it can't find the vector that matches that.

→ You need to **split it into chunks** and embed those, so that the RTOS-related chunk gets captured separately.

![Chunk splitting + retrieval result — the top match was correct across the board](/assets/posts/rag-from-scratch-embedding-and-similarity-search/07-chunk-search-result.png)

In this example too, the absolute similarity values weren't large, but **the top-ranked answer matched correctly every time**.

### Chunk size trade-off

| Chunk size | Precise matching | Context | Noise |
|---|---|---|---|
| **Small** | ✅ | ❌ Lost | ❌ None |
| **Large** | ❌ | ✅ Preserved | ⚠ Increases |

**General recommendation**: 256 to 512 tokens (roughly **500 to 1000 characters** for Korean).

## Retrospective

To sum up today in one line:

> **Embedding is just vector conversion. Meaning is measured with cosine similarity. Long documents need to be split into chunks.**

Two things stood out the most:

1. **A case where there's no code error but the result is strange** — this was a good case for getting a feel for how to debug when the model's output itself seems suspicious. The debugging pattern of changing variables, like single word vs. sentence length, or Korean vs. English.

2. **Actually observing the weakness of Korean embedding** — instead of vaguely hearing that "Korean is weaker," I confirmed it directly through numbers like 0.3 vs. 0.7. I now understand why English embedding + translation (Cross-lingual RAG) became a common pattern.

## Things to study further

### 1. The principles behind embedding (my open question)

- The mechanism by which Transformers turn text into vectors — token embedding → attention → pooling
- The evolution from **Word2Vec / GloVe → BERT / Sentence-BERT → OpenAI Ada / text-embedding-3**
- What the dimensions mean — what each of the 1536 dimensions represents (in reality, uninterpretable, determined through training)
- I want to organize this properly at some point, whether through videos or papers

### 2. Korean-specific embedding models

- **KoSimCSE / KoSBERT** — the de facto standard for Korean sentence embedding
- **multilingual-e5-large** — a multilingual model with decent Korean performance
- **Voyage AI multilingual** — a commercial option
- Comparing Korean embedding model benchmarks (KLUE-STS, etc.) against OpenAI

### 3. Vector DBs

- **pgvector** (Postgres + vector extension) — supported natively by Supabase
- **Pinecone / Weaviate / Chroma / Qdrant** — dedicated vector DBs
- **HNSW vs IVF** indexing algorithms
- The trade-off between simply computing cosine similarity with numpy vs. ANN search in a vector DB

### 4. Chunk splitting strategies

- **Fixed-size chunking** — simply splitting every N tokens
- **Recursive Character Splitter** — breaking down paragraph → sentence → word order (the LangChain standard)
- **Semantic Chunking** — splitting at semantic boundaries (slower but higher quality)
- **Sliding Window + Overlap** — preserving context between chunks
- Experimental methods for finding the optimal chunk size + overlap

### 5. Hybrid search — keyword + semantic

- Vector search alone doesn't do well with **proper nouns / exact code / typos**
- Combining **BM25 (traditional keyword search)** + **vector search** = Hybrid
- **Reciprocal Rank Fusion (RRF)** — a method for merging the rankings of two search results
- Elasticsearch, Weaviate, and others support hybrid search as a first-class feature