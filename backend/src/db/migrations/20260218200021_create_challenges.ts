import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.CHALLENGES, (table) => {
    table.increments("id").primary();
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("SET NULL");
    table.string("title").nullable();
    table.text("description").nullable();
    table.timestamp("start_date").nullable();
    table.timestamp("end_date").nullable();
    table.boolean("is_active").nullable();
    table.integer("category_id").unsigned().nullable().references("id").inTable(TABLE.CATEGORIES).onDelete("SET NULL");
    table.integer("challenge_type_id").unsigned().nullable().references("id").inTable(TABLE.CHALLENGE_TYPES).onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.CHALLENGES);
}
