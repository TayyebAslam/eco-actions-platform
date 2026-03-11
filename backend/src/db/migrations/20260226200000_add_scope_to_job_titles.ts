import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    // Add scope column: 'global' or 'school'
    table.string("scope", 10).notNullable().defaultTo("global");
    table.index("scope");
  });

  // Migrate existing data: if school_id is set, scope = 'school'; otherwise scope = 'global'
  await knex(TABLE.JOB_TITLES)
    .whereNotNull("school_id")
    .update({ scope: "school" });

  // Drop the old global unique index based on school_id
  await knex.raw("DROP INDEX IF EXISTS job_titles_name_global_unique");

  // Drop the old composite unique constraint on (name, school_id)
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.dropUnique(["name", "school_id"]);
  });

  // Create new unique constraint: name must be unique within the same scope
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.unique(["name", "scope"]);
  });

  // Remove the school_id foreign key and column
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.dropIndex("school_id");
    table.dropForeign(["school_id"]);
    table.dropColumn("school_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  // Re-add school_id column
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.index("school_id");
  });

  // Drop the scope-based unique constraint
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.dropUnique(["name", "scope"]);
  });

  // Re-add old unique constraint
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.unique(["name", "school_id"]);
  });

  // Re-add the partial unique index for global titles
  await knex.raw(
    `CREATE UNIQUE INDEX job_titles_name_global_unique ON ${TABLE.JOB_TITLES} (name) WHERE school_id IS NULL`
  );

  // Drop scope column
  await knex.schema.alterTable(TABLE.JOB_TITLES, (table) => {
    table.dropIndex("scope");
    table.dropColumn("scope");
  });
}
