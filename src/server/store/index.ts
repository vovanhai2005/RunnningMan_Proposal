import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseMapsUrl, type ContentFile } from "@/lib/content";
import { isDemo } from "../config";
import { MemoryStore, stagesFromContent } from "./memory";
import { SupabaseStore } from "./supabase";
import type { GameStore } from "./types";

/** Người chơi có sẵn trong chế độ demo (người đầu tiên là người được chơi) */
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

// Kiểu lỏng có chủ ý: sau hot reload, đối tượng trong đây có thể thuộc lớp cũ
const g = globalThis as unknown as {
  __raceDemoStore?: Pick<MemoryStore, "players" | "progress">;
  __raceStore?: unknown;
};

/**
 * Store dùng chung, giữ trong globalThis để không tạo lại mỗi request.
 * Khi `next dev` nạp lại code (hot reload), lớp store được định nghĩa lại: đối tượng cũ trong
 * globalThis thiếu các hàm mới (lỗi "findPlayer is not a function"), nên phải kiểm tra
 * `instanceof` với lớp hiện tại rồi tạo lại. Store demo chép sang dữ liệu đang chơi để không mất.
 */
export function getStore(): GameStore {
  if (isDemo) {
    const old = g.__raceDemoStore;
    if (!(old instanceof MemoryStore)) {
      const store = new MemoryStore(stagesFromContent(loadDemoContent()));
      if (old) {
        store.players = old.players;
        store.progress = old.progress;
      } else {
        for (const [username, acc] of Object.entries(DEMO_ACCOUNTS)) {
          store.addPlayer(`demo:${username}`, acc.name, "/avatar-demo.svg");
        }
      }
      g.__raceDemoStore = store;
      return store;
    }
    return old;
  }
  if (g.__raceStore instanceof SupabaseStore) return g.__raceStore;
  const store = new SupabaseStore();
  g.__raceStore = store;
  return store;
}
