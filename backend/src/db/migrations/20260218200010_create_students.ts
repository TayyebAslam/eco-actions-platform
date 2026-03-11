import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.STUDENTS, (table) => {
    table.integer("user_id").unsigned().primary().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.integer("school_id").unsigned().notNullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.integer("class_id").unsigned().notNullable().references("id").inTable(TABLE.CLASSES).onDelete("CASCADE");
    table.integer("section_id").unsigned().nullable().references("id").inTable(TABLE.SECTIONS).onDelete("SET NULL");
    table.string("name", 255).nullable();
    table.string("avatar_url").nullable();
    table.text("bio").nullable();
    table.integer("level").defaultTo(1);
    table.integer("xp").defaultTo(0);
    table.integer("total_points").defaultTo(0);
    table.integer("streak_days").defaultTo(0);
    table.string("contact_number", 20).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.STUDENTS);
}
