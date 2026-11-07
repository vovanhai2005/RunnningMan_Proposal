import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseMapsUrl, type ContentFile } from "@/lib/content";
import { isDemo } from "../config";
import { MemoryStore, stagesFromContent } from "./memory";
import { SupabaseStore } from "./supabase";
import type { GameStore } from "./types";

export const DEMO_ACCOUNTS: Record<string, { password: string; name: string }> = {
  demo: { password: "demo", name: "Người chơi" },
  test: { password: "test", name: "Tài khoản thử" },
};

function loadDemoContent(): ContentFile {
  const dir = path.join(process.cwd(), "content");
  const file = fs.existsSync(path.join(dir, "stages.json"))
    ? path.join(dir, "stages.json")
    : path.join(dir, "stages.example.json");
  const content = JSON.parse(fs.readFileSync(file, "utf8")) as ContentFile;
  for (const s of content.stages) {
    if ((s.lat == null || s.lng == null) && s.mapsUrl) {
      const p = parseMapsUrl(s.mapsUrl);
      if (p) Object.assign(s, p);
    }
  }
  return content;
}

const g = globalThis as unknown as { __raceDemoStore?: MemoryStore; __raceStore?: GameStore };

export function getStore(): GameStore {
  if (isDemo) {
    if (!g.__raceDemoStore) {
      const store = new MemoryStore(stagesFromContent(loadDemoContent()));
      for (const [username, acc] of Object.entries(DEMO_ACCOUNTS)) {
        store.addPlayer(`demo:${username}`, acc.name, "/avatar-demo.svg");
      }
      g.__raceDemoStore = store;
    }
    return g.__raceDemoStore;
  }
  g.__raceStore ??= new SupabaseStore();
  return g.__raceStore;
}
