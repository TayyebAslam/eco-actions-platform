import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

/**
 * Seed 100 levels with progressive XP gaps.
 *
 * Rules:
 * - Level 1 starts at min_xp = 0 with initial gap = 100
 * - Gap growth gets harder as levels increase:
 *   - Higher 20-level tiers increase faster
 *   - Later levels inside each tier increase even faster
 */
exports.seed = async function (knex: Knex) {
  const totalLevels = 100;
  const levels: Array<{ id: number; title: string; min_xp: number }> = [];

  let minXp = 0;
  let xpGap = 100;

  for (let level = 1; level <= totalLevels; level++) {
    levels.push({
      id: level,
      title: `Level ${level}`,
      min_xp: minXp,
    });

    minXp += xpGap;

    const tier = Math.floor((level - 1) / 20) + 1;
    const growthFactor = 1 + level / 50;
    xpGap += Math.round(10 * tier * growthFactor);
  }

  await knex.transaction(async (trx) => {
    // Keep exactly 100 seeded levels.
    await trx(TABLE.LEVELS).del();
    await trx(TABLE.LEVELS).insert(levels);
  });

  console.log(`Seeded ${totalLevels} levels with progressive XP thresholds.`);
};
