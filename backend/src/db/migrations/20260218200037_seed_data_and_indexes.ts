import { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

export async function up(knex: Knex): Promise<void> {
  // Seed default challenge types
  await knex(TABLE.CHALLENGE_TYPES).insert([
    { name: "recycling", label: "Recycling", description: "Challenges focused on recycling various materials", units: JSON.stringify(["items", "kg", "bottles", "cans", "boxes", "paper"]), is_active: true },
    { name: "waste_reduction", label: "Waste Reduction", description: "Challenges to minimize waste production", units: JSON.stringify(["kg", "items", "bags"]), is_active: true },
    { name: "transportation", label: "Transportation", description: "Challenges related to transportation and mobility", units: JSON.stringify(["km", "trips", "hours"]), is_active: true },
    { name: "eco_transport", label: "Eco Transport", description: "Challenges promoting eco-friendly transportation methods", units: JSON.stringify(["km", "trips", "days"]), is_active: true },
    { name: "energy_saving", label: "Energy Saving", description: "Challenges aimed at reducing energy consumption", units: JSON.stringify(["kwh", "hours", "devices"]), is_active: true },
    { name: "gardening", label: "Gardening", description: "Challenges focused on planting and gardening activities", units: JSON.stringify(["plants", "trees", "square_meter", "hours"]), is_active: true },
    { name: "nature_activity", label: "Nature Activities", description: "Challenges involving outdoor and nature-related activities", units: JSON.stringify(["hours", "activities"]), is_active: true },
    { name: "nutrition", label: "Nutrition", description: "Challenges related to healthy and sustainable eating", units: JSON.stringify(["meals", "servings", "days"]), is_active: true },
    { name: "water_conservation", label: "Water Conservation", description: "Challenges focused on saving and conserving water resources", units: JSON.stringify(["liters", "minutes", "days"]), is_active: true },
    { name: "school_wide", label: "School-Wide", description: "Multi-category challenges for entire school participation", units: JSON.stringify(["items", "kg", "bottles", "cans", "liters", "boxes", "paper", "bags", "days", "kwh", "hours", "plants", "trees", "square_meter", "activities", "meals", "servings", "repairs"]), is_active: true },
  ]);

  // Seed platform modules
  const platformModules = [
    { name: "Schools", key: "schools", scope: "platform" },
    { name: "School Requests", key: "school_requests", scope: "platform" },
    { name: "Super Sub-Admins", key: "super_sub_admins", scope: "platform" },
    { name: "Platform Reports", key: "platform_reports", scope: "platform" },
  ];
  for (const mod of platformModules) {
    const existing = await knex(TABLE.MODULES).where({ key: mod.key }).first();
    if (!existing) await knex(TABLE.MODULES).insert(mod);
  }

  // Add performance indexes
  const indexes = [
    { table: "users", columns: ["role_id"], name: "idx_users_role_id" },
    { table: "users", columns: ["is_active"], name: "idx_users_is_active" },
    { table: "users", columns: ["school_id"], name: "idx_users_school_id" },
    { table: "users", columns: ["is_deleted"], name: "idx_users_is_deleted" },
    { table: "users", columns: ["created_at"], name: "idx_users_created_at" },
    { table: "sections", columns: ["class_id"], name: "idx_sections_class_id" },
    { table: "activities", columns: ["user_id"], name: "idx_activities_user_id" },
    { table: "activities", columns: ["school_id"], name: "idx_activities_school_id" },
    { table: "activities", columns: ["category_id"], name: "idx_activities_category_id" },
    { table: "activities", columns: ["status"], name: "idx_activities_status" },
    { table: "activities", columns: ["created_at"], name: "idx_activities_created_at" },
    { table: "likes", columns: ["activity_id"], name: "idx_likes_activity_id" },
    { table: "likes", columns: ["user_id"], name: "idx_likes_user_id" },
    { table: "comments", columns: ["activity_id"], name: "idx_comments_activity_id" },
    { table: "comments", columns: ["user_id"], name: "idx_comments_user_id" },
    { table: "student_badges", columns: ["user_id"], name: "idx_student_badges_user_id" },
    { table: "student_badges", columns: ["badge_id"], name: "idx_student_badges_badge_id" },
    { table: "points_log", columns: ["user_id"], name: "idx_points_log_user_id" },
    { table: "points_log", columns: ["created_at"], name: "idx_points_log_created_at" },
    { table: "challenges", columns: ["school_id"], name: "idx_challenges_school_id" },
    { table: "challenges", columns: ["is_active"], name: "idx_challenges_is_active" },
    { table: "challenge_variants", columns: ["challenge_id"], name: "idx_challenge_variants_challenge_id" },
    { table: "challenge_progress", columns: ["user_id"], name: "idx_challenge_progress_user_id" },
    { table: "challenge_progress", columns: ["challenge_variant_id"], name: "idx_challenge_progress_variant_id" },
    { table: "challenge_progress", columns: ["status"], name: "idx_challenge_progress_status" },
    { table: "articles", columns: ["school_id"], name: "idx_articles_school_id" },
    { table: "articles", columns: ["author_id"], name: "idx_articles_author_id" },
    { table: "article_views", columns: ["user_id"], name: "idx_article_views_user_id" },
    { table: "article_views", columns: ["article_id"], name: "idx_article_views_article_id" },
    { table: "article_bookmarks", columns: ["user_id"], name: "idx_article_bookmarks_user_id" },
    { table: "article_bookmarks", columns: ["article_id"], name: "idx_article_bookmarks_article_id" },
    { table: "activity_bookmarks", columns: ["user_id"], name: "idx_activity_bookmarks_user_id" },
    { table: "activity_bookmarks", columns: ["activity_id"], name: "idx_activity_bookmarks_activity_id" },
  ];

  for (const idx of indexes) {
    const hasIndex = await knex.raw("SELECT 1 FROM pg_indexes WHERE indexname = ?", [idx.name]);
    if (hasIndex.rows.length === 0) {
      await knex.schema.alterTable(idx.table, (table) => {
        table.index(idx.columns, idx.name);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove indexes
  const indexes = [
    { table: "activity_bookmarks", columns: ["activity_id"], name: "idx_activity_bookmarks_activity_id" },
    { table: "activity_bookmarks", columns: ["user_id"], name: "idx_activity_bookmarks_user_id" },
    { table: "article_bookmarks", columns: ["article_id"], name: "idx_article_bookmarks_article_id" },
    { table: "article_bookmarks", columns: ["user_id"], name: "idx_article_bookmarks_user_id" },
    { table: "article_views", columns: ["article_id"], name: "idx_article_views_article_id" },
    { table: "article_views", columns: ["user_id"], name: "idx_article_views_user_id" },
    { table: "articles", columns: ["author_id"], name: "idx_articles_author_id" },
    { table: "articles", columns: ["school_id"], name: "idx_articles_school_id" },
    { table: "challenge_progress", columns: ["status"], name: "idx_challenge_progress_status" },
    { table: "challenge_progress", columns: ["challenge_variant_id"], name: "idx_challenge_progress_variant_id" },
    { table: "challenge_progress", columns: ["user_id"], name: "idx_challenge_progress_user_id" },
    { table: "challenge_variants", columns: ["challenge_id"], name: "idx_challenge_variants_challenge_id" },
    { table: "challenges", columns: ["is_active"], name: "idx_challenges_is_active" },
    { table: "challenges", columns: ["school_id"], name: "idx_challenges_school_id" },
    { table: "points_log", columns: ["created_at"], name: "idx_points_log_created_at" },
    { table: "points_log", columns: ["user_id"], name: "idx_points_log_user_id" },
    { table: "student_badges", columns: ["badge_id"], name: "idx_student_badges_badge_id" },
    { table: "student_badges", columns: ["user_id"], name: "idx_student_badges_user_id" },
    { table: "comments", columns: ["user_id"], name: "idx_comments_user_id" },
    { table: "comments", columns: ["activity_id"], name: "idx_comments_activity_id" },
    { table: "likes", columns: ["user_id"], name: "idx_likes_user_id" },
    { table: "likes", columns: ["activity_id"], name: "idx_likes_activity_id" },
    { table: "activities", columns: ["created_at"], name: "idx_activities_created_at" },
    { table: "activities", columns: ["status"], name: "idx_activities_status" },
    { table: "activities", columns: ["category_id"], name: "idx_activities_category_id" },
    { table: "activities", columns: ["school_id"], name: "idx_activities_school_id" },
    { table: "activities", columns: ["user_id"], name: "idx_activities_user_id" },
    { table: "sections", columns: ["class_id"], name: "idx_sections_class_id" },
    { table: "users", columns: ["created_at"], name: "idx_users_created_at" },
    { table: "users", columns: ["is_deleted"], name: "idx_users_is_deleted" },
    { table: "users", columns: ["school_id"], name: "idx_users_school_id" },
    { table: "users", columns: ["is_active"], name: "idx_users_is_active" },
    { table: "users", columns: ["role_id"], name: "idx_users_role_id" },
  ];

  for (const idx of indexes) {
    const hasIndex = await knex.raw("SELECT 1 FROM pg_indexes WHERE indexname = ?", [idx.name]);
    if (hasIndex.rows.length > 0) {
      await knex.schema.alterTable(idx.table, (table) => {
        table.dropIndex(idx.columns, idx.name);
      });
    }
  }

  // Remove seeded data
  await knex(TABLE.MODULES).whereIn("key", ["schools", "school_requests", "super_sub_admins", "platform_reports"]).del();
  await knex(TABLE.CHALLENGE_TYPES).del();
}
