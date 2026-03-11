import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.STAFF, (table) => {
    table.integer("user_id").unsigned().primary().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("school_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.string("job_title").nullable();
    table.integer("created_by").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.string("contact_number", 20).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.STAFF);
}
