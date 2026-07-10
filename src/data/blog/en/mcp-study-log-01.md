---
title: "MCP Study #1 — Getting Started with Model Context Protocol · First Call with stdio Server + Inspector"
description: "Starting to study MCP (Model Context Protocol) today. It's a standard protocol created by Anthropic that standardizes how LLMs access external systems. Comparing it with Tool Use → building my first MCP server (say_hello / add_numbers) with the Python SDK → verifying the stdio connection with MCP Inspector → building a fake energy management server that connects with FEMS. Connection failure due to venv python.exe path issue + fix."
pubDatetime: 2026-06-26T04:00:00Z
tags:
  - LLM공부
  - mcp
  - anthropic
  - llm
  - agent
  - tool-use
  - 학습
draft: false
featured: false
---

Starting **MCP study** today.

**MCP = Model Context Protocol** — I didn't know this, but it turns out to be **a standard protocol created by Anthropic** (of course, the GOAT of the LLM world). It's **a standardization of how LLMs access external systems (files, DBs, APIs, etc.)**.

## Table of contents

## Why MCP Is Needed — The Limits of Tool Use

[Tool Use, which I covered before](/en/posts/claude-api-tool-use-and-agent-loop), already lets LLMs interact with the outside world. But there's a problem: **as the number of tools grows, the code gets complicated.**

MCP solves this by **separating tools into a dedicated server**. This gives you:

- **Separation of tool development and LLM app development**
- The ability to **reuse a tool server across multiple LLM apps** once built
- **Standardization** — clients other than Anthropic's can use the same server

![Tool Use vs MCP comparison table — 6 aspects: where defined / where executed / reusability / standard / compatibility / deployment](/assets/posts/mcp-study-log-01/01-tool-use-vs-mcp-table.webp)

| Aspect | Tool Use | MCP |
|---|---|---|
| Where defined | Inside the LLM app code | **Separate server** |
| Where executed | LLM app process | MCP server process |
| Reusability | Hard (copy-paste code) | Easy (reuse the server) |
| Standard | Tied to Anthropic's API | **Universal standard** |
| Compatibility | Anthropic only | Any MCP client |
| Deployment | Bundled with the app | **Independent deployment** |

### When to Use Which

- **Tool Use** — for simple tools used only within your own app
- **MCP** — for tools that need to be reused across multiple places or need standardization

## The 3 Components of MCP

| Component | Definition |
|---|---|
| **Tools** | Functions the LLM **calls** |
| **Resources** | Data the LLM **can read** |
| **Prompts** | Predefined **prompt templates** |

Today I'll focus mainly on **Tools**.

## Communication Methods — stdio vs HTTP/SSE

| Method | Description | Difficulty |
|---|---|---|
| **stdio** | Standard input/output (communication between local processes) | Simple to implement |
| **HTTP/SSE** | Remote server over a network | Complex to implement |

Today I'll do the example using **stdio**. It's enough for a local demo.

## Installing the MCP SDK

The MCP SDK is available for **Python** and **TypeScript**. I'll go with Python.

```bash
pip install mcp
```

## My First MCP Server — `say_hello` + `add_numbers`

Code: [`first_mcp_server.py`](https://github.com/dpcivl/ai-study/blob/main/week5-mcp/first_mcp_server.py)

This is the part where you really feel that **MCP is used in place of Tool Use** — you use the annotation **`@mcp.tool()`**.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("first-mcp-server")

@mcp.tool()
def add_numbers(a: int, b: int) -> int:
    """두 숫자를 더합니다.

    Args:
        a: 첫 번째 숫자
        b: 두 번째 숫자

    Returns:
        두 숫자의 합
    """
    return a + b
```

### Two Key Points

1. **The Args / Returns format in the docstring** — this is what describes the function to the LLM. The format matters.
2. **Type hints on parameters** (`a: int`) — these automatically generate the **input schema**.

Just by writing a single type hint, MCP automatically builds a JSON schema and exposes it to the LLM. Clean.

### Running the Server — No Output

When you run the server, **it just sits there with no output.**

```bash
python first_mcp_server.py
```

**Because it's the stdio approach, the server just waits until an MCP client calls it.** It's normal for nothing to appear on screen.

## Testing with MCP Inspector

To check whether the server is up and whether Tools are properly exposed, **MCP Inspector** is the standard tool:

```bash
npx @modelcontextprotocol/inspector python first_mcp_server.py
```

![MCP Inspector initial screen — Transport Type STDIO, Command python, Arguments .\first_mcp_server.py, still Disconnected](/assets/posts/mcp-study-log-01/02-mcp-inspector-disconnected.webp)

What you can check in Inspector:

- Server connection info
- The list of exposed Tools / Resources / Prompts
- Actual calls + results

### Troubleshooting — Connection Failed

At first, clicking the Connect button didn't establish a connection.

**Cause:** the path to `python.exe` in Command was wrong. It needs to point to the **venv's python**, not the python on the system PATH.

→ After specifying the path to python.exe inside the venv, the connection succeeded.

### Connection Succeeded — Tools Confirmed as Exposed

![Inspector after connecting — Tools tab shows say_hello / add_numbers, with an input form for a=5, b=3 on add_numbers](/assets/posts/mcp-study-log-01/03-mcp-inspector-connected-with-tools.webp)

Two tools, **`say_hello`** and **`add_numbers`**, are exposed on the left. The Args/Returns from the docstring are laid out as-is in the right panel.

- `add_numbers(a=5, b=3)` → result **`8`** ✅

### `say_hello` Call Result

![say_hello result — Tool Result Success, structured content { result: "안녕하세요, 효인님! MCP 서버에서 인사드려요." }](/assets/posts/mcp-study-log-01/04-say-hello-result.webp)

If you provide a name, it returns a greeting string. There's a note saying **Valid according to output schema** — this shows that MCP also validates the output schema.

## Second Example — Energy Management MCP Server

I built an **energy management** MCP server using fake data. It naturally ties into the scenario from the [FEMS project](/en/posts/fems-project-log-02).

![Energy management server — 4 tools: list_production_lines / get_energy_consumption / list_alarms / get_line_status](/assets/posts/mcp-study-log-01/05-energy-management-tools.webp)

4 tools:

| Tool | Purpose |
|---|---|
| `list_production_lines` | List of all production lines in the factory |
| `get_energy_consumption` | Recent power usage for a specific line |
| `list_alarms` | List of alarms (filterable by severity) |
| `get_line_status` | Current operating status of a line |

### Call Result

![get_energy_consumption(line_1) result — rated capacity 150kW, average 128.0kW, hourly breakdown shown](/assets/posts/mcp-study-log-01/06-energy-consumption-result.webp)

The results come out fine. **It's fake data for now**, but once connected to a real DB, this could support:

- Checking power efficiency / finding areas for improvement
- Identifying where alarms occur + analyzing causes
- Monitoring operating status per line

If you naturally layer an LLM on top of this, it becomes a **"factory operations assistant."**

## Retrospective — MCP as a "Detached Tool"

Summary of today's learning:

> **MCP = separating the tools from Tool Use into a dedicated server** + wrapping it all in a standard protocol.

The flow, as I experienced it:

1. Define tools on the server using the `@mcp.tool()` decorator
2. Connect with MCP Inspector to check exposed tools + call them directly
3. In the next stage, **when the LLM hits a node that needs to use a tool, it calls the MCP server** → bringing the result back into the LLM's context. That's the full picture.

## What to Study Next

### 1. Claude Desktop Integration

- The `claude_desktop_config.json` configuration format
- Registering a local server + the flow where Claude automatically recognizes the tools
- Call logging / debugging patterns

### 2. HTTP/SSE Communication

- Operating a remote MCP server — auth / TLS / rate limiting
- Trade-offs versus stdio (latency / operational cost / security)
- Serving multiple LLM clients simultaneously from a single server

### 3. Resources / Prompts

- **Resources** — the pattern of exposing a file system / DB records as URIs
- **Prompts** — reusable prompt templates (variable substitution + context injection)
- Design differences between using only Tools vs using all three

### 4. MCP Server Security

- Combining this with the risky-tool approval pattern covered in [Human-in-the-Loop](/en/posts/langgraph-study-log-03-human-in-the-loop)
- Defining permissions / scope at the MCP server level
- Gating policies for when MCP exposes a risky tool like `delete_user`

### 5. Public MCP Server Catalogs

- Lists of official Anthropic and community MCP servers
- Integration servers for GitHub / Slack / filesystem / Notion / Linear, etc.
- Trade-offs between building your own vs using a public server

### 6. Integrating MCP with LangGraph / Agent Frameworks

- Connecting an MCP client to LangGraph's ToolNode
- Using multiple MCP servers simultaneously within a single agent
- Routing tool calls (figuring out which server has which tool)