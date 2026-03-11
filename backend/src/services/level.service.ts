import db from "../config/db";
import { ApplyLevelFormulaDTO, CreateLevelDTO, UpdateLevelDTO } from "../dto/level.dto";
import { TABLE } from "../utils/Database/table";
import { LevelError } from "../utils/errors";
import { invalidateLevels } from "../utils/services/redis/cacheInvalidation";



export class LevelService {
  async createLevel(data: CreateLevelDTO): Promise<Record<string, unknown>> {
    const { id, title, min_xp } = data;

    const existingLevel = await db(TABLE.LEVELS).where("id", id).first();
    if (existingLevel) {
      throw new LevelError("Level with this ID already exists", 400);
    }

    const overlappingLevel = await db(TABLE.LEVELS).where("min_xp", min_xp).first();
    if (overlappingLevel) {
      throw new LevelError("A level with this XP threshold already exists", 400);
    }

    const [newLevel] = await db(TABLE.LEVELS)
      .insert({
        id,
        title,
        min_xp,
      })
      .returning("*");

    await invalidateLevels();
    return newLevel;
  }

  async getAllLevels(): Promise<Record<string, unknown>[]> {
    const levels = await db(TABLE.LEVELS).orderBy("min_xp", "asc");

    for (const level of levels) {
      const studentsCount = await db(TABLE.STUDENTS)
        .where("level", level.id)
        .count({ count: "*" });
      level.students_count = parseInt(studentsCount[0]?.count as string) || 0;
    }

    return levels;
  }

  async getLevelById(id: string | number): Promise<Record<string, unknown>> {
    const level = await db(TABLE.LEVELS).where("id", id).first();
    if (!level) {
      throw new LevelError("Level not found", 404);
    }

    const studentsCount = await db(TABLE.STUDENTS)
      .where("level", id)
      .count({ count: "*" });

    return {
      ...level,
      students_count: parseInt(studentsCount[0]?.count as string) || 0,
    };
  }

  async updateLevel(id: string | number, data: UpdateLevelDTO): Promise<Record<string, unknown>> {
    const existingLevel = await db(TABLE.LEVELS).where("id", id).first();
    if (!existingLevel) {
      throw new LevelError("Level not found", 404);
    }

    const { title, min_xp } = data;

    if (min_xp !== undefined && min_xp !== existingLevel.min_xp) {
      const overlappingLevel = await db(TABLE.LEVELS)
        .where("min_xp", min_xp)
        .whereNot("id", id)
        .first();

      if (overlappingLevel) {
        throw new LevelError("A level with this XP threshold already exists", 400);
      }
    }

    const updateData: Record<string, string | number> = {};
    if (title !== undefined) updateData.title = title;
    if (min_xp !== undefined) updateData.min_xp = min_xp;

    const [updatedLevel] = await db(TABLE.LEVELS)
      .where("id", id)
      .update(updateData)
      .returning("*");

    await invalidateLevels();
    return updatedLevel;
  }

  async applyLevelFormula(data: ApplyLevelFormulaDTO): Promise<{
    formula: ApplyLevelFormulaDTO;
    preview: {
      first: Array<{ id: number; title: string; min_xp: number }>;
      last: Array<{ id: number; title: string; min_xp: number }>;
    };
  }> {
    const {
      total_levels,
      base_min_xp,
      initial_gap,
      tier_size,
      base_increment,
      growth_divisor,
      title_prefix,
    } = data;

    const generatedLevels: Array<{ id: number; title: string; min_xp: number }> = [];
    let minXp = base_min_xp;
    let xpGap = initial_gap;

    for (let level = 1; level <= total_levels; level++) {
      generatedLevels.push({
        id: level,
        title: `${title_prefix} ${level}`,
        min_xp: minXp,
      });

      minXp += xpGap;
      const tier = Math.floor((level - 1) / tier_size) + 1;
      const growthFactor = 1 + level / growth_divisor;
      xpGap += Math.round(base_increment * tier * growthFactor);
    }

    await db.transaction(async (trx) => {
      await trx(TABLE.LEVELS).del();
      await trx(TABLE.LEVELS).insert(generatedLevels);

      await trx.raw(`
        UPDATE ${TABLE.STUDENTS} s
        SET level = COALESCE(
          (
            SELECT l.id
            FROM ${TABLE.LEVELS} l
            WHERE l.min_xp <= s.xp
            ORDER BY l.min_xp DESC
            LIMIT 1
          ),
          1
        )
      `);
    });

    await invalidateLevels();

    return {
      formula: data,
      preview: {
        first: generatedLevels.slice(0, 5),
        last: generatedLevels.slice(-5),
      },
    };
  }

  async deleteLevel(id: string | number): Promise<Record<string, unknown>> {
    const level = await db(TABLE.LEVELS).where("id", id).first();
    if (!level) {
      throw new LevelError("Level not found", 404);
    }

    const studentsCount = await db(TABLE.STUDENTS)
      .where("level", id)
      .count({ count: "*" });

    if (parseInt(studentsCount[0]?.count as string) > 0) {
      throw new LevelError("Cannot delete level with students at this level", 400);
    }

    await db(TABLE.LEVELS).where("id", id).del();
    await invalidateLevels();

    return level;
  }
}

export { LevelError } from "../utils/errors";

export const levelService = new LevelService();
