const { poolPromise, sql } = require("../config/db");
const fs = require("fs");

/**
 * 1. Lấy lịch sử nộp bài của sinh viên theo Milestone 
 */
exports.getSubmissionsByMilestone = async (milestoneId, thesisId) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("milestone_id", sql.Int, milestoneId)
    .input("thesis_id", sql.Int, thesisId)
    .query(`
      SELECT 
        id, milestone_id, thesis_id, student_id, file_name, file_url, 
        note, score, status, submitted_at
      FROM Submissions
      WHERE milestone_id = @milestone_id AND thesis_id = @thesis_id
      ORDER BY submitted_at DESC
    `);
  return result.recordset;
};

/**
 * 2. Lấy danh sách nộp bài phức tạp
 */
exports.getSubmissionsByThesis = async (thesisId, filters = {}) => {
  const { milestoneId, studentId } = filters;
  const pool = await poolPromise;

  const result = await pool
    .request()
    .input("thesisId",    sql.Int, thesisId)
    .input("milestoneId", sql.Int, milestoneId || null)
    .input("studentId",   sql.Int, studentId   || null)
    .query(`
      SELECT
        s.id, s.milestone_id, s.thesis_id, s.student_id, s.file_name, s.file_url, s.file_size,
        s.note, s.score, s.status, s.submitted_at, s.graded_at,
        m.title       AS milestone_title,
        m.deadline    AS milestone_deadline,
        m.status      AS milestone_status,
        u.name        AS student_name,
        u.email       AS student_email
      FROM Submissions s
      JOIN Milestones m ON m.id = s.milestone_id
      JOIN Users u      ON u.id = s.student_id
      WHERE  (@thesisId IS NULL OR s.thesis_id = @thesisId)
        AND (@milestoneId IS NULL OR s.milestone_id = @milestoneId)
        AND (@studentId   IS NULL OR s.student_id   = @studentId)
      ORDER BY s.submitted_at DESC
    `);

  return result.recordset;
};

/**
 * 3. Lấy chi tiết 1 bài nộp (Code nhánh main)
 */
exports.getSubmissionById = async (id) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT
        s.*,
        m.title    AS milestone_title,
        m.deadline AS milestone_deadline,
        u.name     AS student_name,
        u.email    AS student_email
      FROM Submissions s
      JOIN Milestones m ON m.id = s.milestone_id
      JOIN Users u      ON u.id = s.student_id
      WHERE s.id = @id
    `);

  return result.recordset[0] || null;
};

/**
 * 4. TẠO MỚI BÀI NỘP (GỘP HOÀN HẢO 2 LUỒNG)
 */
exports.createSubmission = async (data, file) => {
  
  const milestoneId = data.milestoneId || data.milestone_id;
  const thesisId = data.thesisId || data.thesis_id;
  const studentId = data.studentId || data.student_id;
  const note = data.note;

  const pool = await poolPromise;

  // Kiểm tra milestone thuộc đúng thesis và còn active
  const milestoneCheck = await pool
    .request()
    .input("milestoneId", sql.Int, milestoneId)
    .input("thesisId",    sql.Int, thesisId)
    .query(`
      SELECT id, status FROM Milestones
      WHERE id = @milestoneId AND thesis_id = @thesisId
    `);

  if (milestoneCheck.recordset.length === 0) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error("Không tìm thấy milestone hoặc milestone không thuộc thesis này");
  }

  if (milestoneCheck.recordset[0].status === "closed") {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error("Milestone đã đóng, không thể nộp bài");
  }

  // Phân luồng: 
  let fileUrl = data.file_url || data.fileUrl;
  let fileName = data.file_name || data.fileName;
  let fileSize = data.file_size || data.fileSize || 0;

  if (file) {
    fileUrl = `uploads/${file.filename}`;
    fileName = file.originalname;
    fileSize = file.size;
  }

  const result = await pool
    .request()
    .input("milestoneId", sql.Int,      milestoneId)
    .input("thesisId",    sql.Int,      thesisId)
    .input("studentId",   sql.Int,      studentId)
    .input("fileUrl",     sql.NVarChar, fileUrl || "")
    .input("fileName",    sql.NVarChar, fileName || "Báo cáo")
    .input("fileSize",    sql.BigInt,   fileSize)          
    .input("note",        sql.NVarChar, note || null)
    .query(`
      INSERT INTO Submissions
        (milestone_id, thesis_id, student_id, file_url, file_name, file_size, note, status, submitted_at)
      OUTPUT INSERTED.*
      VALUES
        (@milestoneId, @thesisId, @studentId, @fileUrl, @fileName, @fileSize, @note, 'submitted', GETDATE());
    `);

  return result.recordset[0];
};

/**
 * 5. XÓA BÀI NỘP (CÓ CHẶN LỖI XÓA LINK HTTP)
 */
exports.deleteSubmission = async (id) => {
  const pool = await poolPromise;

  const existing = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT id, file_url FROM Submissions WHERE id = @id");

  if (existing.recordset.length === 0) {
    throw new Error("Không tìm thấy submission");
  }

  const { file_url } = existing.recordset[0];
  
  if (file_url && !file_url.startsWith("http")) {
    const resolvedPath = file_url.startsWith("uploads/")
      ? file_url.replace("uploads/", "public/uploads/")
      : file_url;
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM Submissions WHERE id = @id");
};