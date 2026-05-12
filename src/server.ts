import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VastAiClient } from "./vastai/client.js";
import { registerInstanceTools } from "./vastai/instances.js";
import { registerOfferTools } from "./vastai/offers.js";
import { registerSshTools } from "./vastai/ssh.js";
import { registerBillingTools } from "./vastai/billing.js";

export function createServer(): McpServer {
  const apiKey = process.env.VAST_API_KEY;
  if (!apiKey) {
    console.error("ERROR: VAST_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const client = new VastAiClient(apiKey);

  const server = new McpServer({
    name: "vastai-mcp-server",
    version: "1.0.0",
  });

  registerInstanceTools(server, client);
  registerOfferTools(server, client);
  registerSshTools(server, client);
  registerBillingTools(server, client);

  return server;
}
