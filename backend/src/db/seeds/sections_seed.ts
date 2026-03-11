import type { Knex } from "knex";
import { TABLE } from "../../utils/Database/table";

/**
 * Seed the 4 standard global sections: A, B, C, D.
 *
 * Sections are school/class agnostic — just like classes — so only 4 rows
 * ever exist in this table regardless of how many schools or classes there are.
 * The school + class context is carried by the students/teacher_sections rows.
 */
exports.seed = async function (knex: Knex) {
  const standardSections = [
    { name: "A" },
    { name: "B" },
    { name: "C" },
    { name: "D" },
  ];

  // Fetch existing section names
  const existingSections = await knex(TABLE.SECTIONS).select("name");
  const existingNames = existingSections.map((s: { name: string }) => s.name);

  // Only insert sections that are not already present
  const sectionsToInsert = standardSections.filter(
    (s) => !existingNames.includes(s.name)
  );

  if (sectionsToInsert.length > 0) {
    await knex(TABLE.SECTIONS).insert(sectionsToInsert);
    console.log(
      `Inserted ${sectionsToInsert.length} new section(s):`,
      sectionsToInsert.map((s) => s.name).join(", ")
    );
  } else {
    console.log("All standard sections already exist, skipping seed.");
  }
};
