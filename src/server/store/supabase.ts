import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config";
import type {
  GameStore,
  PlayerPatch,
  PlayerRow,
  ProgressPatch,
  ProgressRow,
  StageRoutePatch,
  StageRow,
} from "./types";

let admin: SupabaseClient | null = null;

/** Client dùng khóa service role — chỉ tồn tại trên server, bỏ qua RLS. */
export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements GameStore {
  private db = supabaseAdmin();

  async getPlayerByUserId(userId: string) {
    const res = await this.db.from("players").select("*").eq("user_id", userId).maybeSingle();
    return check(res) as PlayerRow | null;
  }

  async listStages() {
    const res = await this.db.from("stages").select("*").order("stage_order", { ascending: true });
    return (check(res) ?? []).map(
      ({ stage_order, ...s }: StageRow & { stage_order: number }): StageRow => ({
        ...s,
        order: stage_order,
        lat: Number(s.lat),
        lng: Number(s.lng),
        answers: s.answers ?? [],
        hints: s.hints ?? [],
      }),
    );
  }

  async listProgress(playerId: string) {
    const res = await this.db.from("progress").select("*").eq("player_id", playerId);
    return (check(res) ?? []) as ProgressRow[];
  }

  async updatePlayer(playerId: string, patch: PlayerPatch) {
    const res = await this.db.from("players").update(patch).eq("id", playerId).select("*").single();
    return check(res) as PlayerRow;
  }

  async upsertProgress(playerId: string, stageId: string, patch: ProgressPatch) {
    const res = await this.db
      .from("progress")
      .upsert(
        { player_id: playerId, stage_id: stageId, ...patch },
        { onConflict: "player_id,stage_id" },
      )
      .select("*")
      .single();
    return check(res) as ProgressRow;
  }

  async updateStageRoute(stageId: string, patch: StageRoutePatch) {
    check(await this.db.from("stages").update(patch).eq("id", stageId));
  }
}
