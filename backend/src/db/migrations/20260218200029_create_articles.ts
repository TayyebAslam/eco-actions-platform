import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.ARTICLES, (table) => {
    table.increments("id").primary();
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("SET NULL");
    table.integer("author_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.string("title").nullable();
    table.text("content").nullable();
    table.string("cover_image").nullable();
    table.integer("points").defaultTo(10);
    table.integer("category_id").unsigned().nullable().references("id").inTable(TABLE.CATEGORIES).onDelete("SET NULL");
    table.string("thumbnail_image").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.ARTICLES);
}
