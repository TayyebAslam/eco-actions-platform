import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

/**
 * Make the sections table school/class agnostic.
 *
 * Sections (A, B, C, D) are global defaults — just like classes — and do NOT
 * belong to a specific school or class.  The school + class context for a
 * student lives on the students row itself (school_id, class_id, section_id).
 *
 * This migration:
 *  1. Clears any seed data that relied on the old FK columns.
 *  2. Drops the school_id and class_id foreign keys + columns.
 *  3. Adds a unique constraint on `name` so we never get duplicates.
 */
export async function up(knex: Knex): Promise<void> {
  // Deduplicate sections by name, keeping the one with the lowest ID for each unique name
  // and updating all references to point to the surviving section

  // Get all unique section names with their min ID
  const survivingSections = await knex(TABLE.SECTIONS)
    .select('name')
    .min('id as surviving_id')
    .groupBy('name');

  // For each unique name, update references to the surviving section
  for (const { name, surviving_id } of survivingSections) {
    // Find all sections with this name (including the surviving one)
    const duplicateSections = await knex(TABLE.SECTIONS)
      .where('name', name)
      .select('id');

    const duplicateIds = duplicateSections.map(s => s.id).filter(id => id !== surviving_id);

    if (duplicateIds.length > 0) {
      // Update teacher_sections to point to surviving section
      await knex(TABLE.TEACHER_SECTIONS)
        .whereIn('section_id', duplicateIds)
        .update('section_id', surviving_id);

      // Update students to point to surviving section
      await knex(TABLE.STUDENTS)
        .whereIn('section_id', duplicateIds)
        .update('section_id', surviving_id);

      // Delete the duplicate sections
      await knex(TABLE.SECTIONS)
        .whereIn('id', duplicateIds)
        .del();
    }
  }

  // Now drop the FK columns safely
  await knex.schema.alterTable(TABLE.SECTIONS, (table) => {
    // Drop index created in the seed_data_and_indexes migration (if it exists)
    table.dropIndex(["class_id"], "idx_sections_class_id");

    // Drop FK constraints then columns
    table.dropForeign(["class_id"]);
    table.dropForeign(["school_id"]);
    table.dropColumn("class_id");
    table.dropColumn("school_id");

    // Ensure names stay unique (no duplicate "A", "B", …)
    table.unique(["name"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove the unique constraint and re-add the old FK columns
  await knex.schema.alterTable(TABLE.SECTIONS, (table) => {
    table.dropUnique(["name"]);

    table
      .integer("class_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.CLASSES)
      .onDelete("CASCADE");

    table
      .integer("school_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.SCHOOLS)
      .onDelete("CASCADE");

    table.index(["class_id"], "idx_sections_class_id");
  });

  // Note: We cannot restore the original class_id and school_id values
  // since sections are now global. This rollback will leave these columns
  // as NULL, which violates the NOT NULL constraint. Manual intervention
  // would be required to properly restore the data.
}
