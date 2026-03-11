import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.ARTICLE_READS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("article_id").unsigned().notNullable().references("id").inTable(TABLE.ARTICLES).onDelete("CASCADE");
    table.timestamp("read_at").defaultTo(knex.fn.now());
    table.unique(["user_id", "article_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.ARTICLE_READS);
}
