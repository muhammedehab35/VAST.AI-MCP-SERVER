import "dotenv/config";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "./server.js";

const app = express();
app.use(express.json());

const activeTransports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  activeTransports.set(sessionId, transport);

  res.on("close", () => {
    activeTransports.delete(sessionId);
  });

  const server = createServer();
  await server.connect(transport);
  console.error(`SSE client connected: ${sessionId}`);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = activeTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "vastai-mcp-server",
    version: "1.0.0",
    sessions: activeTransports.size,
  });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.error(`Vast.ai MCP server (SSE/HTTP) listening on port ${PORT}`);
  console.error(`  SSE endpoint:    http://localhost:${PORT}/sse`);
  console.error(`  Messages:        http://localhost:${PORT}/messages`);
  console.error(`  Health check:    http://localhost:${PORT}/health`);
});
