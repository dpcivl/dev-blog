---
title: "MCP Study #2 — Connecting My MCP Server to Claude Desktop · Tool Calls + Approval UX"
description: "Actually connecting the energy-management MCP server I built yesterday to Claude Desktop. From finding claude_desktop_config.json (Settings → Developer → Edit Config) → registering the server → restarting → checking the connectors menu → asking 'show me the factory line list' and watching Claude call the tool with the 'Always Allow/Deny' approval UX. Question raised: how do you use RAG and MCP together? (Answer: wrap RAG in an MCP server)"
pubDatetime: 2026-06-26T23:30:00Z
tags:
  - LLM공부
  - mcp
  - anthropic
  - claude-desktop
  - llm
  - agent
  - 학습
draft: false
featured: false
---

Following [MCP Study #1 (first call with Inspector)](/en/posts/mcp-study-log-01), today I'm connecting to an actual LLM client — **Claude Desktop**.

Yesterday I only verified server behavior with MCP Inspector. **Today's goal is to actually call my server from Claude Desktop.**

## Table of contents

## Registering MCP in Claude Desktop — finding the config file

Claude Desktop automatically connects to any MCP server registered in **`claude_desktop_config.json`**. So all I need to do is edit this file correctly.

The problem is that **it's not obvious where this json file is** at first (I struggled with this too).

### How to find it

1. **Click the account icon in the bottom left** → open the settings menu
2. Click the **"Developer"** tab under the **"Desktop App"** section in the bottom left

![Claude Desktop settings — Developer tab on the left / 'Local MCP servers: No servers added' + Edit Config and Developer Docs buttons on the right](/assets/posts/mcp-study-log-02-claude-desktop/01-local-mcp-server-settings.webp)

3. Click the **"Edit Config"** button → a popup opens the folder containing `claude_desktop_config.json`

### Registering the server in the config file

In my case, **I expected an empty file since I'd never registered an MCP server before**, but there was already some `cowork`-related config in there. It seems Claude Desktop pre-populates this itself.

I added the `command` and `args` for my server:

```json
{
  "mcpServers": {
    "energy-management": {
      "command": "python",
      "args": ["C:/path/to/energy_mcp_server.py"]
    }
  }
}
```

After saving, **restart Claude Desktop.**

## Confirming registration — connectors menu

Check the list of registered MCP servers via the **+ button** in the bottom left of the chat window → **Connectors**:

![+ button → Connectors menu → 'energy-management' toggle turned on, 'Claude in Chrome' also visible](/assets/posts/mcp-study-log-02-claude-desktop/02-connector-menu-energy-management.webp)

**`energy-management`** shows up exactly as I typed it in the json. I turn the toggle ON to activate it.

## Actually calling the tool — and my first encounter with the approval UX

I typed **"Show me the factory line list"** into the chat window. Claude automatically tries to use the tool from the MCP server:

![After the question: Thinking → Finding tools → a card saying 'Claude wants to use List production lines from energy-management' with Always Allow/Deny buttons](/assets/posts/mcp-study-log-02-claude-desktop/03-tool-call-with-approval.webp)

### The interesting part — user approval is inserted into the tool call

> **"Claude wants to use List production lines from energy-management"** + [Always Allow / Deny] buttons

This is exactly the client-side implementation of the [HITL pattern I covered in LangGraph #3](/en/posts/langgraph-study-log-03-human-in-the-loop). Claude Desktop **inserts a user approval gate right before the MCP tool call, on its own.** I didn't have to implement anything — the client itself provides this safety layer.

Once approved, it takes the result and formats a natural-language answer. **The response quality is the same as what I verified yesterday with streamlit.**

## Cowork recommendation — a separate topic to study

While going through this, a banner popped up:

![Banner suggesting running in the background with Cowork — 'Cowork can handle complex tasks across energy-management without you watching directly'](/assets/posts/mcp-study-log-02-claude-desktop/04-cowork-suggestion-banner.webp)

Claude recommended, **"Why not try this in Cowork?"** Cowork isn't part of what I'm currently studying, so I'm leaving **using MCP within Cowork as a separate track** for now.

## Adding a new tool → restart → instant recognition

I added a tool to the existing code and restarted Claude Desktop, and **the new tool was recognized immediately.** So the development cycle is simple:

> Edit code → save → restart Claude Desktop → new tool available

Today's study session wrapped up quickly. (Maybe it was deliberately light since it's the weekend...)

## Question — how do you use RAG and MCP together?

MCP turned out to be convenient, but there's one thing that's a bit unsatisfying — **it doesn't connect with the [FEMS RAG](/en/posts/fems-project-log-03) I've already built.**

- RAG → a separate backend that calls an API (bundled inside Streamlit)
- MCP → called directly within the Claude Desktop app

It feels like these are two separate worlds. **Isn't there a way to use both together?**

### The answer — wrap RAG itself as an MCP server

Thinking about it, the answer turns out to be surprisingly simple:

> **Just wrap the RAG search function with `@mcp.tool()` and expose it as an MCP server.**

```python
@mcp.tool()
def search_fems_documents(query: str, top_k: int = 5) -> list[dict]:
    """Search for relevant chunks in the FEMS guidelines."""
    # Same existing RAG code — Chroma search → return chunks
    return rag_pipeline.search(query, top_k)
```

This way, when Claude Desktop receives a question:

1. It decides whether a general answer is sufficient
2. If domain knowledge is needed → it automatically calls `search_fems_documents`
3. It responds using the retrieved chunk context + LLM reasoning

→ **The user just uses Claude Desktop as normal, while RAG runs behind the scenes.** Claude Desktop itself becomes the front end, with no need for a separate UI like Streamlit.

## Retrospective

Today's short study session, summarized:

1. **Finding `claude_desktop_config.json`: Settings → Desktop App → Developer → Edit Config** — it's normal to be confused about where it is at first
2. **Claude Desktop provides its own tool call approval UX** — client-side HITL
3. **The development cycle is simple** — edit code → restart → instant recognition
4. **The fix for the RAG ↔ MCP separation** — wrap the RAG function with `@mcp.tool()`

## Things to study further

### 1. All the options in claude_desktop_config.json

- Additional options beyond `command` / `args`, like `env` / `cwd`
- Avoiding conflicts when registering multiple MCP servers at once
- Where the per-server enabled/disabled toggle lives
- The pattern of specifying a venv path via `cwd` (automating the venv troubleshooting from #1)

### 2. RAG ↔ MCP integration patterns

- Auxiliary tools beyond `search_documents(query, top_k)`, like `get_chunk_by_id` / `list_collections`
- Whether Claude can **chain** multiple tool calls (search → augment → re-search)
- Returning search results as-is vs. having the LLM summarize them
- Whether to combine hybrid search (vector + keyword) into one tool or keep them separate

### 3. Client-side tool approval UX

- How a tool is managed after selecting "Always Allow"
- An option to force explicit confirmation every time for risky tools
- The division of labor between [LangGraph's server-side HITL](/en/posts/langgraph-study-log-03-human-in-the-loop) and client-side approval

### 4. Cowork × MCP

- Permissions for MCP tool calls when Cowork runs in the background
- Autonomous execution without human approval vs. step-by-step approval
- Separate policies for risky tools

### 5. Resources / Prompts UX in Claude Desktop

- How [Resources / Prompts covered in #1](/en/posts/mcp-study-log-01) appear in Claude Desktop
- The pattern of attaching a Resource URI directly in the chat window
- Whether prompt templates are exposed like slash commands

### 6. Debugging MCP servers

- Where to find Claude Desktop logs when the server dies or errors out
- Patterns for inspecting stdio communication payloads
- A first diagnostic checklist for when a tool doesn't show up