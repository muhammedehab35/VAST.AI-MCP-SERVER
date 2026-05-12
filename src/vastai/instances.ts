import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VastAiClient } from "./client.js";

interface Instance {
  id: number;
  label?: string;
  actual_status?: string;
  gpu_name?: string;
  num_gpus?: number;
  dph_total?: number;
  image_uuid?: string;
  ssh_host?: string;
  ssh_port?: number;
  inet_up?: number;
  inet_down?: number;
  disk_space?: number;
  start_date?: number;
  end_date?: number;
  uptime?: number;
}

interface InstancesResponse {
  instances: Instance[];
}

interface InstanceResponse {
  instances: Instance[];
}

function formatInstance(i: Instance): string {
  const status = i.actual_status ?? "unknown";
  const gpu = `${i.num_gpus ?? 1}x ${i.gpu_name ?? "GPU"}`;
  const price = i.dph_total != null ? `$${i.dph_total.toFixed(4)}/h` : "N/A";
  const ssh =
    i.ssh_host && i.ssh_port ? `ssh root@${i.ssh_host} -p ${i.ssh_port}` : "N/A";
  const uptime =
    i.start_date != null
      ? `${Math.round((Date.now() / 1000 - i.start_date) / 60)} min`
      : "N/A";

  return [
    `ID: ${i.id}`,
    `Label: ${i.label ?? "(none)"}`,
    `Status: ${status}`,
    `GPU: ${gpu}`,
    `Price: ${price}`,
    `Image: ${i.image_uuid ?? "N/A"}`,
    `SSH: ${ssh}`,
    `Uptime: ${uptime}`,
    `Disk: ${i.disk_space ?? "N/A"} GB`,
  ].join("\n");
}

export function registerInstanceTools(server: McpServer, client: VastAiClient) {
  server.registerTool(
    "list_instances",
    {
      description: "List all your Vast.ai instances",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await client.get<InstancesResponse>("/instances/");
      const instances = data.instances ?? [];
      if (instances.length === 0) {
        return { content: [{ type: "text", text: "No instances found." }] };
      }
      const text = instances.map(formatInstance).join("\n\n---\n\n");
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "get_instance",
    {
      description: "Get details of a specific Vast.ai instance by ID",
      inputSchema: z.object({
        id: z.number().describe("Instance ID"),
      }),
    },
    async ({ id }) => {
      const data = await client.get<InstanceResponse>(`/instances/${id}/`);
      const instance = (data.instances ?? [])[0];
      if (!instance) {
        return {
          content: [{ type: "text", text: `Instance ${id} not found.` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: formatInstance(instance) }] };
    }
  );

  server.registerTool(
    "create_instance",
    {
      description: "Rent a GPU instance from a Vast.ai offer",
      inputSchema: z.object({
        offer_id: z.number().describe("Offer ID to rent"),
        image: z.string().describe('Docker image, e.g. "pytorch/pytorch:latest"'),
        disk: z.number().describe("Disk space in GB"),
        ssh: z.boolean().default(true).describe("Enable SSH access"),
        direct: z.boolean().default(false).describe("Use direct connection"),
        label: z.string().optional().describe("Optional instance label"),
        env: z
          .record(z.string())
          .optional()
          .describe("Environment variables"),
        onstart: z.string().optional().describe("Startup script"),
      }),
    },
    async ({ offer_id, image, disk, ssh, direct, label, env, onstart }) => {
      const body: Record<string, unknown> = {
        image,
        disk,
        ssh,
        direct,
      };
      if (label) body.label = label;
      if (env) body.env = env;
      if (onstart) body.onstart = onstart;

      const data = await client.put<{ new_contract: number }>(
        `/asks/${offer_id}/`,
        body
      );
      return {
        content: [
          {
            type: "text",
            text: `Instance created successfully!\nContract ID: ${data.new_contract}\nImage: ${image}\nDisk: ${disk} GB\nSSH: ${ssh}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "start_instance",
    {
      description: "Start a stopped Vast.ai instance",
      inputSchema: z.object({
        id: z.number().describe("Instance ID"),
      }),
    },
    async ({ id }) => {
      await client.put(`/instances/${id}/`, { state: "running" });
      return {
        content: [
          { type: "text", text: `Instance ${id} is starting up.` },
        ],
      };
    }
  );

  server.registerTool(
    "stop_instance",
    {
      description: "Stop a running Vast.ai instance (without destroying it)",
      inputSchema: z.object({
        id: z.number().describe("Instance ID"),
      }),
    },
    async ({ id }) => {
      await client.put(`/instances/${id}/`, { state: "stopped" });
      return {
        content: [{ type: "text", text: `Instance ${id} is stopping.` }],
      };
    }
  );

  server.registerTool(
    "destroy_instance",
    {
      description: "Permanently destroy a Vast.ai instance",
      inputSchema: z.object({
        id: z.number().describe("Instance ID to destroy"),
      }),
    },
    async ({ id }) => {
      await client.delete(`/instances/${id}/`);
      return {
        content: [
          {
            type: "text",
            text: `Instance ${id} has been permanently destroyed.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "reboot_instance",
    {
      description: "Reboot a Vast.ai instance",
      inputSchema: z.object({
        id: z.number().describe("Instance ID"),
      }),
    },
    async ({ id }) => {
      await client.put(`/instances/${id}/`, { state: "restarting" });
      return {
        content: [{ type: "text", text: `Instance ${id} is rebooting.` }],
      };
    }
  );
}
