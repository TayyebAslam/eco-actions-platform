export type CreateLevelDTO = {
  id: number;
  title: string;
  min_xp: number;
};

export type UpdateLevelDTO = {
  title?: string;
  min_xp?: number;
};

export type ApplyLevelFormulaDTO = {
  total_levels: number;
  base_min_xp: number;
  initial_gap: number;
  tier_size: number;
  base_increment: number;
  growth_divisor: number;
  title_prefix: string;
};