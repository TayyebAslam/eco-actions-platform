import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

/**
 * Seed standard global classes 1 to 12
 * These classes are shared across all schools
 */
exports.seed = async function (knex: Knex) {
  // Define standard classes from 1 to 12
  const standardClasses = [
    { name: "Class 1" },
    { name: "Class 2" },
    { name: "Class 3" },
    { name: "Class 4" },
    { name: "Class 5" },
    { name: "Class 6" },
    { name: "Class 7" },
    { name: "Class 8" },
    { name: "Class 9" },
    { name: "Class 10" },
    { name: "Class 11" },
    { name: "Class 12" },
  ];
  

  // Get existing class names
  const existingClasses = await knex(TABLE.CLASSES).select("name");
  const existingClassNames = existingClasses.map((c: { name: string }) => c.name);

  // Filter out classes that already exist
  const classesToInsert = standardClasses.filter(
    (c) => !existingClassNames.includes(c.name)
  );

  if (classesToInsert.length > 0) {
    await knex(TABLE.CLASSES).insert(classesToInsert);
    console.log(`Inserted ${classesToInsert.length} new classes:`, classesToInsert.map(c => c.name).join(", "));
  } else {
    console.log("All standard classes already exist, skipping seed.");
  }
};