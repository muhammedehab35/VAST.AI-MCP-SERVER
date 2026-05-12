import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VastAiClient } from "./client.js";

interface UserResponse {
  ssh_key?: string;
  id?: number;
  username?: string;
}

export function registerSshTools(server: McpServer, client: VastAiClient) {
  server.registerTool(
    "list_ssh_keys",
    {
      description: "List SSH keys registered on your Vast.ai account",
      inputSchema: z.object({}),
    },
    async () => {
      const user = await client.get<UserResponse>("/users/current/");
      const keys = user.ssh_key ?? "";
      if (!keys.trim()) {
        return {
          content: [{ type: "text", text: "No SSH keys found on your account." }],
        };
      }
      const keyList = keys
        .split("\n")
        .filter((k) => k.trim())
        .map((k, i) => `Key ${i + 1}: ${k.trim()}`)
        .join("\n");
      return { content: [{ type: "text", text: `SSH Keys:\n${keyList}` }] };
    }
  );

  server.registerTool(
    "add_ssh_key",
    {
      description: "Add a new SSH public key to your Vast.ai account",
      inputSchema: z.object({
        ssh_key: z
          .string()
          .describe("The SSH public key string (e.g. ssh-rsa AAAA... user@host)"),
      }),
    },
    async ({ ssh_key }) => {
      const user = await client.get<UserResponse>("/users/current/");
      const existing = user.ssh_key ?? "";
      const newKeys = existing.trim()
        ? `${existing.trim()}\n${ssh_key.trim()}`
        : ssh_key.trim();

      await client.put("/users/current/", { ssh_key: newKeys });
      return {
        content: [
          { type: "text", text: "SSH key added successfully to your account." },
        ],
      };
    }
  );

  server.registerTool(
    "attach_ssh_key",
    {
      description: "Attach an SSH key to a specific Vast.ai instance",
      inputSchema: z.object({
        instance_id: z.number().describe("Instance ID"),
        ssh_key: z.string().describe("SSH public key to attach"),
      }),
    },
    async ({ instance_id, ssh_key }) => {
      await client.post(`/instances/${instance_id}/ssh/`, { ssh_key });
      return {
        content: [
          {
            type: "text",
            text: `SSH key attached to instance ${instance_id}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "detach_ssh_key",
    {
      description: "Detach an SSH key from a specific Vast.ai instance",
      inputSchema: z.object({
        instance_id: z.number().describe("Instance ID"),
        key_id: z.string().describe("SSH key identifier to detach"),
      }),
    },
    async ({ instance_id, key_id }) => {
      await client.delete(`/instances/${instance_id}/ssh/${key_id}/`);
      return {
        content: [
          {
            type: "text",
            text: `SSH key ${key_id} detached from instance ${instance_id}.`,
          },
        ],
      };
    }
  );
}
