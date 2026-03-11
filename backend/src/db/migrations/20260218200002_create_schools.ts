import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.SCHOOLS, (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.string("slug").unique().nullable();
    table.text("logo_url").nullable();
    table.text("address").nullable();
    table.string("subscription_status").defaultTo("active");
    table.boolean("is_active").defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.SCHOOLS);
}
