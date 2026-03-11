import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

/**
 * Seed numeric classes 1 to 12
 * These classes use simple numeric names (1, 2, 3, etc.)
 */
exports.seed = async function (knex: Knex) {
  // Define numeric classes from 1 to 12
  const numericClasses = [
    { name: "1" },
    { name: "2" },
    { name: "3" },
    { name: "4" },
    { name: "5" },
    { name: "6" },
    { name: "7" },
    { name: "8" },
    { name: "9" },
    { name: "10" },
    { name: "11" },
    { name: "12" },
  ];

  // Get existing class names
  const existingClasses = await knex(TABLE.CLASSES).select("name");
  const existingClassNames = existingClasses.map((c: { name: string }) => c.name);

  // Filter out classes that already exist
  const classesToInsert = numericClasses.filter(
    (c) => !existingClassNames.includes(c.name)
  );

  if (classesToInsert.length > 0) {
    await knex(TABLE.CLASSES).insert(classesToInsert);
    console.log(`Inserted ${classesToInsert.length} numeric classes:`, classesToInsert.map(c => c.name).join(", "));
  } else {
    console.log("All numeric classes already exist, skipping seed.");
  }
};
