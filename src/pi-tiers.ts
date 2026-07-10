import { PI_TYPES_MAP } from "@/const";

/**
 * PI product tiers, derived from the group_id already present in PI_TYPES_MAP.
 * P0 raw planetary resources / P1 refined / P2 basic / P3 advanced / P4 advanced.
 *
 * Verified against src/const.ts group_ids:
 *   1032/1033/1035 -> raw (Base/Noble/Heavy Metals, gases, organics)
 *   1042 -> Reactive/Precious/Toxic Metals, Water, Oxygen, Plasmoids...  (P1)
 *   1034 -> Construction Blocks, Mechanical Parts, Coolant, Enriched Uranium... (P2)
 *   1040 -> Robotics, Supercomputers, Guidance Systems... (P3)
 *   1041 -> Broadcast Node, Wetware Mainframe... (P4)
 */
export type Tier = "P0" | "P1" | "P2" | "P3" | "P4";

const GROUP_TIER: Record<number, Tier> = {
  1032: "P0",
  1033: "P0",
  1035: "P0",
  1042: "P1",
  1034: "P2",
  1040: "P3",
  1041: "P4",
};

export const tierOf = (typeId: number): Tier | undefined =>
  GROUP_TIER[PI_TYPES_MAP[typeId]?.group_id];

export const nameOf = (typeId: number): string =>
  PI_TYPES_MAP[typeId]?.name ?? `Type ${typeId}`;

/** Accent colors used across the pipeline / manifest / rebalance views. */
export const TIER_COLORS: Record<Tier, string> = {
  P0: "#8a8f98", // extract — stays on planet
  P1: "#7cb6f2", // import — counterpart flown in
  P2: "#f2c14e", // export — the payload you carry out
  P3: "#c58af9",
  P4: "#f28b82",
};

export const TIER_LABEL: Record<Tier, string> = {
  P0: "Raw",
  P1: "Refined",
  P2: "Basic",
  P3: "Advanced",
  P4: "Advanced",
};
