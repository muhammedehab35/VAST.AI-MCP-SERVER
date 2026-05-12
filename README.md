# Vast.ai MCP Server

A **Model Context Protocol (MCP)** server for the [Vast.ai](https://vast.ai) GPU cloud platform.
Control your GPU instances, search offers, manage SSH keys, and track billing — all from your AI assistant.

Supports **stdio** (Claude Desktop / Claude Code) and **SSE/HTTP** (LangGraph / LangChain) dual transport.

---

## Features

- **15 MCP tools** covering the full Vast.ai workflow
- **Dual transport**: stdio for Claude Desktop, SSE/HTTP for Python agents
- **TypeScript strict** — fully typed, no `any`
- **Zod validation** on all tool inputs
- **Auto-retry** on HTTP 429 (rate limit)
- **Human-readable** output — no raw JSON dumps

---

## Requirements

- Node.js >= 18
- A [Vast.ai](https://vast.ai) account with an API key
- API key permissions: **User**, **Instances**, **Billing** — Read + Write, **no 2FA required**

---

## Installation

### Option A — npx (recommended, no install needed)

```json
{
  "mcpServers": {
    "vastai": {
      "command": "npx",
      "args": ["-y", "vastai-mcp-server"],
      "env": {
        "VAST_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Option B — Clone & build

```bash
git clone https://github.com/muhammedehab35/VAST.AI-MCP-SERVER
cd vastai-mcp-server
npm install
npm run build
```

---

## API Key Setup

1. Go to [console.vast.ai](https://console.vast.ai) → **Account** → **API Keys**
2. Click **Create API Key**
3. Enable: **User** (Read+Write), **Instances** (Read+Write), **Billing** (Read+Write), **Miscellaneous**
4. **Disable all 2FA toggles** (each permission row must have grey 2FA toggle)
5. Click **Save** and copy the key

---

## Configuration

```bash
cp .env.example .env
# Add your key:
# VAST_API_KEY=your_key_here
```

---

## Usage

### Claude Desktop (stdio)

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vastai": {
      "command": "npx",
      "args": ["-y", "vastai-mcp-server"],
      "env": {
        "VAST_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop — the 15 Vast.ai tools will appear automatically.

---

### Claude Code (VS Code extension)

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "vastai": {
      "command": "npx",
      "args": ["-y", "vastai-mcp-server"],
      "env": {
        "VAST_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

---

### SSE/HTTP mode — LangGraph / LangChain

Start the HTTP server:

```bash
npm run start:http
# or
PORT=3000 VAST_API_KEY=your_key npx vastai-mcp-server http
```

Endpoints:
| Endpoint | Description |
|---|---|
| `GET /sse` | SSE connection for MCP clients |
| `POST /messages` | Message handler |
| `GET /health` | Health check |

#### Python (LangGraph)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "vastai": {
        "url": "http://localhost:3000/sse",
        "transport": "sse"
    }
})
tools = await client.get_tools()
```

#### Python (LangChain direct)

```python
from langchain_mcp_adapters.client import MCPClient

async with MCPClient("http://localhost:3000/sse", transport="sse") as client:
    tools = await client.list_tools()
```

---

### Development mode

```bash
npm run dev          # stdio — no build needed
npm run dev:http     # SSE/HTTP — no build needed
```

---

## Available Tools (15 total)

### Instances

| Tool | Description | Required params | Optional params |
|---|---|---|---|
| `list_instances` | List all your instances | — | — |
| `get_instance` | Get details of one instance | `id` | — |
| `create_instance` | Rent a GPU from an offer | `offer_id`, `image`, `disk` | `ssh`, `direct`, `label`, `env`, `onstart` |
| `start_instance` | Start a stopped instance | `id` | — |
| `stop_instance` | Stop a running instance | `id` | — |
| `destroy_instance` | Permanently destroy an instance | `id` | — |
| `reboot_instance` | Reboot an instance | `id` | — |

### GPU Offers

| Tool | Description | Optional params |
|---|---|---|
| `search_offers` | Search available GPUs, sorted by price | `gpu_name`, `num_gpus`, `max_price`, `min_ram`, `disk_space`, `cuda_version`, `limit` |

### SSH Keys

| Tool | Description | Required params |
|---|---|---|
| `list_ssh_keys` | List SSH keys on your account | — |
| `add_ssh_key` | Add a public SSH key to account | `ssh_key` |
| `attach_ssh_key` | Attach an SSH key to an instance | `instance_id`, `ssh_key` |
| `detach_ssh_key` | Detach an SSH key from an instance | `instance_id`, `key_id` |

### Billing & Account

| Tool | Description | Required params |
|---|---|---|
| `get_account_info` | Account info + current balance | — |
| `get_billing_history` | Billing summary | — |
| `get_instance_cost` | Estimated cost of a running instance | `id` |

---

## Example Prompts

```
Search for RTX 4090 GPUs under $0.40/h with at least 24GB VRAM
Find the cheapest H100 available with CUDA 12+
List all my running instances
Create an instance with offer ID 12345 using pytorch/pytorch:latest, 50GB disk, SSH enabled
Stop instance 99999
Destroy instance 88888 — training is done
Reboot instance 77777, it seems frozen
What is my current balance?
How much has instance 12345 cost me so far?
Show my SSH keys
Add this SSH key to my account: ssh-ed25519 AAAA...
Search for 4x A100 GPUs for distributed training
```

---

## Tool Output Example

```
#1 Offer ID: 12345678
GPU: 1x RTX 4090
Price: $0.2900/h
VRAM: 24576 MB VRAM
RAM: 64 GB RAM
Disk: 80 GB
CUDA: 12.2
Network: ↑1000 Mbps / ↓1000 Mbps
Country: US
Reliability: 99.2%
```

---

## Project Structure

```
vastai-mcp-server/
├── src/
│   ├── index.ts            # Entry point — stdio mode
│   ├── server.ts           # MCP server core + tool registration
│   ├── http.ts             # Entry point — SSE/HTTP mode
│   └── vastai/
│       ├── client.ts       # Vast.ai REST API wrapper (fetch + retry)
│       ├── instances.ts    # Instance management (7 tools)
│       ├── offers.ts       # GPU offer search (1 tool)
│       ├── ssh.ts          # SSH key management (4 tools)
│       └── billing.ts      # Billing & account (3 tools)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Error Handling

| Error | Cause | Solution |
|---|---|---|
| `401 Invalid user key` | Wrong API key | Check your `VAST_API_KEY` |
| `401 Requires 2FA` | 2FA enabled on key | Recreate key with all 2FA toggles OFF |
| `404 Instance not found` | Wrong instance ID | Use `list_instances` to get valid IDs |
| `429 Rate limit` | Too many requests | Automatic retry with 1s backoff |

---

## License

MIT
