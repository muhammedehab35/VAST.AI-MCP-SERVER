import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VastAiClient } from "./client.js";

interface UserResponse {
  id?: number;
  username?: string;
  email?: string;
  credit?: number;
  balance?: number;
  billed_amount?: number;
  paid?: number;
  tax?: number;
  billaddress?: string;
  has_billing?: boolean;
  bw_used?: number;
}

interface Instance {
  id: number;
  label?: string;
  gpu_name?: string;
  num_gpus?: number;
  dph_total?: number;
  actual_status?: string;
  start_date?: number;
}

interface InstancesResponse {
  instances: Instance[];
}

export function registerBillingTools(server: McpServer, client: VastAiClient) {
  server.registerTool(
    "get_account_info",
    {
      description: "Get your Vast.ai account information and current balance",
      inputSchema: z.object({}),
    },
    async () => {
      const user = await client.get<UserResponse>("/users/current/");
      const balance = user.credit ?? user.balance ?? 0;
      const lines = [
        `Account: ${user.username ?? "N/A"} (${user.email ?? "N/A"})`,
        `User ID: ${user.id ?? "N/A"}`,
        `Current Balance: $${balance.toFixed(4)}`,
        `Total Billed: $${(user.billed_amount ?? 0).toFixed(4)}`,
        `Total Paid: $${(user.paid ?? 0).toFixed(4)}`,
        `Billing Configured: ${user.has_billing ? "Yes" : "No"}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "get_billing_history",
    {
      description: "Get your Vast.ai billing and credit history summary",
      inputSchema: z.object({}),
    },
    async () => {
      const user = await client.get<UserResponse>("/users/current/");
      const lines = [
        "=== Billing Summary ===",
        `Current Credit: $${(user.credit ?? 0).toFixed(4)}`,
        `Total Amount Billed: $${(user.billed_amount ?? 0).toFixed(4)}`,
        `Total Amount Paid: $${(user.paid ?? 0).toFixed(4)}`,
        `Tax: $${(user.tax ?? 0).toFixed(4)}`,
        `Bandwidth Used: ${(user.bw_used ?? 0).toFixed(2)} GB`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "get_instance_cost",
    {
      description:
        "Get the current running cost of an active Vast.ai instance",
      inputSchema: z.object({
        id: z.number().describe("Instance ID"),
      }),
    },
    async ({ id }) => {
      const data = await client.get<InstancesResponse>("/instances/");
      const instance = (data.instances ?? []).find((i) => i.id === id);
      if (!instance) {
        return {
          content: [
            { type: "text", text: `Instance ${id} not found.` },
          ],
          isError: true,
        };
      }

      const dph = instance.dph_total ?? 0;
      const startDate = instance.start_date;
      const uptimeSeconds =
        startDate != null ? Date.now() / 1000 - startDate : 0;
      const uptimeHours = uptimeSeconds / 3600;
      const totalCost = dph * uptimeHours;

      const lines = [
        `Instance ${id} — ${instance.label ?? "(no label)"}`,
        `GPU: ${instance.num_gpus ?? 1}x ${instance.gpu_name ?? "GPU"}`,
        `Status: ${instance.actual_status ?? "unknown"}`,
        `Rate: $${dph.toFixed(4)}/h`,
        `Uptime: ${uptimeHours.toFixed(2)} hours`,
        `Estimated Cost: $${totalCost.toFixed(4)}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
