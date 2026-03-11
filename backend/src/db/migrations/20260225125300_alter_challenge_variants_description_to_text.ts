import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE.CHALLENGE_VARIANTS, (table) => {
    // Change description from varchar(255) to text to support up to 500 chars
    table.text("description").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // WARNING: Rollback will truncate description values longer than 255 characters
  await knex.schema.alterTable(TABLE.CHALLENGE_VARIANTS, (table) => {
    table.string("description").nullable().alter();
  });
}
