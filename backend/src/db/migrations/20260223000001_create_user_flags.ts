import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.USER_FLAGS, (table) => {
    table.increments("id").primary();
    table
      .integer("student_user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.USERS)
      .onDelete("CASCADE");
    table
      .integer("teacher_user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.USERS)
      .onDelete("CASCADE");
    table
      .integer("school_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable(TABLE.SCHOOLS)
      .onDelete("CASCADE");
    table.string("reason", 100).notNullable();
    table.text("note").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.unique(
      ["student_user_id", "teacher_user_id"],
      "uq_user_flags_student_teacher"
    );
    table.index(["school_id"], "idx_user_flags_school_id");
    table.index(["student_user_id"], "idx_user_flags_student_user_id");
    table.index(["teacher_user_id"], "idx_user_flags_teacher_user_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.USER_FLAGS);
}

