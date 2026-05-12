import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VastAiClient } from "./client.js";

interface Offer {
  id: number;
  gpu_name?: string;
  num_gpus?: number;
  dph_total?: number;
  gpu_ram?: number;
  cpu_ram?: number;
  disk_space?: number;
  cuda_max_good?: number;
  country?: string;
  inet_up?: number;
  inet_down?: number;
  reliability2?: number;
  dlperf?: number;
}

interface BundlesResponse {
  offers: Offer[];
}

function formatOffer(o: Offer, rank: number): string {
  const gpu = `${o.num_gpus ?? 1}x ${o.gpu_name ?? "GPU"}`;
  const price = o.dph_total != null ? `$${o.dph_total.toFixed(4)}/h` : "N/A";
  const vram = o.gpu_ram != null ? `${o.gpu_ram} MB VRAM` : "N/A";
  const ram = o.cpu_ram != null ? `${Math.round(o.cpu_ram / 1024)} GB RAM` : "N/A";
  const cuda = o.cuda_max_good != null ? `CUDA ${o.cuda_max_good}` : "N/A";
  const net =
    o.inet_up != null && o.inet_down != null
      ? `↑${o.inet_up} Mbps / ↓${o.inet_down} Mbps`
      : "N/A";
  const reliability =
    o.reliability2 != null ? `${(o.reliability2 * 100).toFixed(1)}%` : "N/A";

  return [
    `#${rank} Offer ID: ${o.id}`,
    `GPU: ${gpu}`,
    `Price: ${price}`,
    `VRAM: ${vram}`,
    `RAM: ${ram}`,
    `Disk: ${o.disk_space ?? "N/A"} GB`,
    `CUDA: ${cuda}`,
    `Network: ${net}`,
    `Country: ${o.country ?? "N/A"}`,
    `Reliability: ${reliability}`,
  ].join("\n");
}

export function registerOfferTools(server: McpServer, client: VastAiClient) {
  server.registerTool(
    "search_offers",
    {
      description:
        "Search for available GPU offers on Vast.ai, sorted by price",
      inputSchema: z.object({
        gpu_name: z
          .string()
          .optional()
          .describe('GPU model filter, e.g. "RTX_4090", "A100", "H100"'),
        num_gpus: z
          .number()
          .optional()
          .describe("Minimum number of GPUs"),
        max_price: z
          .number()
          .optional()
          .describe("Maximum price per hour in USD"),
        min_ram: z
          .number()
          .optional()
          .describe("Minimum GPU VRAM in MB"),
        disk_space: z
          .number()
          .optional()
          .describe("Minimum disk space in GB"),
        cuda_version: z
          .string()
          .optional()
          .describe('Minimum CUDA version, e.g. "12.0"'),
        limit: z
          .number()
          .default(20)
          .describe("Maximum number of results (default: 20)"),
      }),
    },
    async ({ gpu_name, num_gpus, max_price, min_ram, disk_space, cuda_version, limit }) => {
      const queryParts: string[] = ["rentable=true", "rented=false"];

      if (gpu_name) queryParts.push(`gpu_name=${gpu_name}`);
      if (num_gpus) queryParts.push(`num_gpus>=${num_gpus}`);
      if (max_price) queryParts.push(`dph_total<=${max_price}`);
      if (min_ram) queryParts.push(`gpu_ram>=${min_ram}`);
      if (disk_space) queryParts.push(`disk_space>=${disk_space}`);
      if (cuda_version) queryParts.push(`cuda_max_good>=${cuda_version}`);

      const params: Record<string, string> = {
        q: JSON.stringify({ order: [["dph_total", "asc"]], limit: String(limit) }),
      };
      for (const part of queryParts) {
        const [key, ...rest] = part.split(/([<>!=]=?|=)/);
        if (key && rest.length >= 2) {
          params[key.trim()] = rest.slice(1).join("").trim();
        }
      }

      const data = await client.get<BundlesResponse>("/bundles/", {
        q: JSON.stringify({
          verified: { eq: true },
          external: { eq: false },
          rentable: { eq: true },
          rented: { eq: false },
          ...(gpu_name ? { gpu_name: { eq: gpu_name } } : {}),
          ...(num_gpus ? { num_gpus: { gte: num_gpus } } : {}),
          ...(max_price ? { dph_total: { lte: max_price } } : {}),
          ...(min_ram ? { gpu_ram: { gte: min_ram } } : {}),
          ...(disk_space ? { disk_space: { gte: disk_space } } : {}),
          ...(cuda_version ? { cuda_max_good: { gte: parseFloat(cuda_version) } } : {}),
          order: [["dph_total", "asc"]],
          limit,
        }),
      });

      const offers = (data.offers ?? []).slice(0, limit);
      if (offers.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No offers found matching your criteria.",
            },
          ],
        };
      }

      const summary = `Found ${offers.length} offer(s) sorted by price:\n\n`;
      const text = summary + offers.map((o, i) => formatOffer(o, i + 1)).join("\n\n---\n\n");
      return { content: [{ type: "text", text }] };
    }
  );
}
