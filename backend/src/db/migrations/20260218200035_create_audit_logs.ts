import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE.AUDIT_LOGS, (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().nullable().references("id").inTable(TABLE.USERS).onDelete("SET NULL");
    table.string("user_email").nullable();
    table.string("user_role").nullable();
    table.integer("school_id").unsigned().nullable().references("id").inTable(TABLE.SCHOOLS).onDelete("SET NULL");
    table.enum("action", ["CREATE", "UPDATE", "DELETE", "VIEW", "LOGIN", "LOGOUT", "APPROVE", "REJECT", "EXPORT", "IMPORT", "TOGGLE_STATUS", "ASSIGN", "REMOVE", "PASSWORD_CHANGE", "EMAIL_CHANGE", "PERMISSION_UPDATE", "BULK_DELETE", "BULK_UPDATE"]).notNullable();
    table.string("module").notNullable();
    table.integer("resource_id").nullable();
    table.text("resource_name").nullable();
    table.jsonb("details").nullable();
    table.string("ip_address").nullable();
    table.text("user_agent").nullable();
    table.enum("status", ["success", "failure"]).defaultTo("success");
    table.text("error_message").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.index("user_id");
    table.index("school_id");
    table.index("action");
    table.index("module");
    table.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE.AUDIT_LOGS);
}
