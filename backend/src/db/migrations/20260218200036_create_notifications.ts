import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.NOTIFICATIONS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable(TABLE.USERS).onDelete("CASCADE");
    table.enum("type", ["activity_approved", "activity_rejected", "pending_activities", "challenge_joined", "school_request", "new_article", "comment_received", "system_alert"]).notNullable();
    table.string("title", 255).notNullable();
    table.text("message").notNullable();
    table.integer("aggregate_count").nullable();
    table.string("aggregate_key", 255).nullable();
    table.string("resource_type", 50).nullable();
    table.integer("resource_id").nullable();
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("CASCADE");
    table.boolean("is_read").defaultTo(false);
    table.timestamp("read_at").nullable();
    table.timestamps(true, true);
    table.index("user_id");
    table.index("is_read");
    table.index("aggregate_key");
    table.index(["user_id", "is_read", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.NOTIFICATIONS);
}
