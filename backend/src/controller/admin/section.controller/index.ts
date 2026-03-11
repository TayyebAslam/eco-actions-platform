import { Request, Response } from "express";
import asyncHandler from "../../../middlewares/trycatch";
import { sendResponse } from "../../../utils/helperFunctions/responseHelper";
import { UserRole } from "../../../utils/enums/users.enum";
import { validateRequest } from "../../../validations";
import {
  createSectionSchema,
  updateSectionSchema,
} from "../../../validations/section.validation";
import { TABLE } from "../../../utils/Database/table";
import db from "../../../config/db";

export const createSection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN &&
        requesterRole !== UserRole.SUB_ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to create sections", false);
        return;
      }

      const { classId } = req.params;

      const data = validateRequest(createSectionSchema, req.body, res);
      if (!data) return;

      const { name } = data;

      // Verify class exists
      const classItem = await db(TABLE.CLASSES).where("id", classId).first();

      if (!classItem) {
        sendResponse(res, 404, "Class not found", false);
        return;
      }

      // Check if section with same name exists globally
      const existingSection = await db(TABLE.SECTIONS)
        .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
        .first();

      if (existingSection) {
        sendResponse(res, 400, "Section with this name already exists", false);
        return;
      }

      const [newSection] = await db(TABLE.SECTIONS)
        .insert({
          name,
        })
        .returning("*");

      sendResponse(res, 201, "Section created successfully", true, newSection);
      return;
    } catch (error: unknown) {
      console.error("Error creating section:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const getAllSections = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId } = req.params;
      const { page, limit, search } = req.query;

      // Verify class exists
      const classItem = await db(TABLE.CLASSES).where("id", classId).first();

      if (!classItem) {
        sendResponse(res, 404, "Class not found", false);
        return;
      }

      const pageSize = parseInt(page as string) || 1;
      const pageLimit = parseInt(limit as string) || 10;
      const skip = (pageSize - 1) * pageLimit;

      let query = db(TABLE.SECTIONS);

      if (search) {
        query = query.where("name", "ilike", `%${search}%`);
      }

      const sections = await query
        .clone()
        .offset(skip)
        .limit(pageLimit)
        .orderBy("name", "asc");

      // Get students count and teachers count for each section within this class
      for (const section of sections) {
        const studentsCount = await db(TABLE.STUDENTS)
          .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
          .where(`${TABLE.STUDENTS}.section_id`, section.id)
          .where(`${TABLE.STUDENTS}.class_id`, classId)
          .where(`${TABLE.USERS}.is_deleted`, false)
          .count({ count: "*" });
        section.students_count = parseInt(studentsCount[0]?.count as string) || 0;

        const teachersCount = await db(TABLE.TEACHER_SECTIONS)
          .join(TABLE.USERS, `${TABLE.TEACHER_SECTIONS}.teacher_id`, `${TABLE.USERS}.id`)
          .where(`${TABLE.TEACHER_SECTIONS}.section_id`, section.id)
          .where(`${TABLE.USERS}.is_deleted`, false)
          .count({ count: "*" });
        section.teachers_count = parseInt(teachersCount[0]?.count as string) || 0;
      }

      // Get total count
      let countQuery = db(TABLE.SECTIONS);
      if (search) {
        countQuery = countQuery.where("name", "ilike", `%${search}%`);
      }
      const totalCountResult = await countQuery.count({ count: "*" });
      const totalCount = parseInt(totalCountResult[0]?.count as string) || 0;

      const responseData = {
        data: sections,
        page: pageSize,
        limit: pageLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
        class: classItem,
      };

      sendResponse(res, 200, "Sections fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching sections:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const getSectionById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, id } = req.params;

      const section = await db(TABLE.SECTIONS)
        .where({ id })
        .first();

      if (!section) {
        sendResponse(res, 404, "Section not found", false);
        return;
      }

      // Get class info
      const classItem = await db(TABLE.CLASSES).where("id", classId).first();

      // Get students for this section in this class
      const students = await db(TABLE.STUDENTS)
        .select(
          `${TABLE.STUDENTS}.*`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.USERS}.is_active`
        )
        .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
        .where(`${TABLE.STUDENTS}.section_id`, id)
        .where(`${TABLE.STUDENTS}.class_id`, classId)
        .where(`${TABLE.USERS}.is_deleted`, false);

      // Get teachers for this section
      const teachers = await db(TABLE.TEACHER_SECTIONS)
        .select(
          `${TABLE.USERS}.id`,
          `${TABLE.USERS}.email`,
          `${TABLE.USERS}.first_name`,
          `${TABLE.USERS}.last_name`,
          `${TABLE.STAFF}.job_title`
        )
        .join(TABLE.USERS, `${TABLE.TEACHER_SECTIONS}.teacher_id`, `${TABLE.USERS}.id`)
        .join(TABLE.STAFF, `${TABLE.USERS}.id`, `${TABLE.STAFF}.user_id`)
        .where(`${TABLE.TEACHER_SECTIONS}.section_id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false);

      const responseData = {
        ...section,
        class: classItem,
        students,
        teachers,
      };

      sendResponse(res, 200, "Section fetched successfully", true, responseData);
      return;
    } catch (error: unknown) {
      console.error("Error fetching section:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const updateSection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN &&
        requesterRole !== UserRole.SUB_ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to update sections", false);
        return;
      }

      const { classId, id } = req.params;

      const data = validateRequest(updateSectionSchema, req.body, res);
      if (!data) return;

      const existingSection = await db(TABLE.SECTIONS)
        .where({ id })
        .first();

      if (!existingSection) {
        sendResponse(res, 404, "Section not found", false);
        return;
      }

      const { name } = data;

      // Check if name is unique globally (if updating name)
      if (name && name.toLowerCase() !== existingSection.name?.toLowerCase()) {
        const nameExists = await db(TABLE.SECTIONS)
          .whereRaw("LOWER(name) = ?", [name.toLowerCase()])
          .whereNot("id", id)
          .first();

        if (nameExists) {
          sendResponse(res, 400, "Section with this name already exists", false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;

      const [updatedSection] = await db(TABLE.SECTIONS)
        .where({ id })
        .update(updateData)
        .returning("*");

      sendResponse(res, 200, "Section updated successfully", true, updatedSection);
      return;
    } catch (error: unknown) {
      console.error("Error updating section:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);

export const deleteSection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterRole = req.user?.role;

      if (
        requesterRole !== UserRole.SUPER_ADMIN &&
        requesterRole !== UserRole.ADMIN
      ) {
        sendResponse(res, 403, "You don't have permission to delete sections", false);
        return;
      }

      const { classId, id } = req.params;

      const section = await db(TABLE.SECTIONS)
        .where({ id })
        .first();

      if (!section) {
        sendResponse(res, 404, "Section not found", false);
        return;
      }

      // Check if section has students (globally, across all classes)
      const studentsCount = await db(TABLE.STUDENTS)
        .join(TABLE.USERS, `${TABLE.STUDENTS}.user_id`, `${TABLE.USERS}.id`)
        .where(`${TABLE.STUDENTS}.section_id`, id)
        .where(`${TABLE.USERS}.is_deleted`, false)
        .count({ count: "*" });

      if (parseInt(studentsCount[0]?.count as string) > 0) {
        sendResponse(
          res,
          400,
          "Cannot delete section with students. Please remove students first.",
          false
        );
        return;
      }

      await db(TABLE.SECTIONS).where({ id }).del();

      sendResponse(res, 200, "Section deleted successfully", true);
      return;
    } catch (error: unknown) {
      console.error("Error deleting section:", error);
      sendResponse(res, 500, "Internal server error", false);
      return;
    }
  }
);
