import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  // Create job_titles table
  await knex.schema.createTable(TABLE.JOB_TITLES, (table) => {
    table.increments("id").primary();
    table.string("name", 100).notNullable();
    table.text("description").nullable();
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.integer("created_by").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.timestamps(true, true);
    
    // Unique constraint: name must be unique within the same scope (global or school-specific)
    table.unique(["name", "school_id"]);
    
    // Add index for faster queries
    table.index("school_id");
    table.index("name");
  });

  // Partial unique index: global job titles (school_id IS NULL) must have unique names
  await knex.raw(
    `CREATE UNIQUE INDEX job_titles_name_global_unique ON ${TABLE.JOB_TITLES} (name) WHERE school_id IS NULL`
  );

  // Add job_title_id to staff table
  await knex.schema.alterTable(TABLE.STAFF, (table) => {
    // Add job_title_id as foreign key (nullable for backward compatibility)
    table.integer("job_title_id").unsigned().nullable().references("id").inTable(TABLE.JOB_TITLES).onDelete("SET NULL");
    
    // Add index for faster queries
    table.index("job_title_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order
  await knex.schema.alterTable(TABLE.STAFF, (table) => {
    table.dropColumn("job_title_id");
  });

  await knex.raw('DROP INDEX IF EXISTS job_titles_name_global_unique');
  await knex.schema.dropTableIfExists(TABLE.JOB_TITLES);
}
