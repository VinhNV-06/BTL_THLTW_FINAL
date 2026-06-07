const { poolPromise, sql } = require("../config/db");
const notificationService = require("./notification.service");

// =========================================================================
// 1. DASHBOARD
// =========================================================================

const getStudentDashboard = async (studentId) => {
  const pool = await poolPromise;

  // Ưu tiên đề tài đã được duyệt, sau đó mới đến đề tài mới nhất
  const result = await pool
    .request()
    .input("studentId", sql.Int, studentId)
    .query(`
      SELECT TOP 1
        t.id AS thesisId,
        t.title AS thesisTitle,
        u.name AS advisorName,
        t.lecturer_status,
        t.admin_status,
        CASE
          WHEN t.admin_status = 'rejected' OR t.lecturer_status = 'rejected' THEN 'rejected'
          WHEN t.admin_status = 'approved' AND t.lecturer_status = 'approved' THEN 'approved'
          ELSE 'pending'
        END AS status
      FROM Thesis t
      LEFT JOIN Users u ON t.lecturer_id = u.id
      WHERE t.student_id = @studentId
        AND (t.status IS NULL OR t.status <> 'forum')
        AND t.title NOT LIKE 'DIEN_DAN_CHUNG_LOP_%'
      ORDER BY
        CASE WHEN t.admin_status = 'approved' AND t.lecturer_status = 'approved' THEN 0 ELSE 1 END,
        t.created_at DESC
    `);

  // Chưa có đề tài → lấy tên GV từ lớp học
  if (result.recordset.length === 0 || !result.recordset[0].thesisId) {
    const advisorResult = await pool
      .request()
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT TOP 1 u.name AS advisorName
        FROM ClassStudents cs
        INNER JOIN Classes c ON cs.class_id = c.id
        INNER JOIN Users u ON c.lecturer_id = u.id
        WHERE cs.student_id = @studentId
      `);

    return {
      thesisId: null,
      thesisTitle: null,
      advisorName: advisorResult.recordset[0]?.advisorName || null,
      status: "not_registered",
      systemMessage: "Bạn chưa đăng ký đề tài khóa luận. Vui lòng vào mục đăng ký.",
      supportEmail: "support@ptit.edu.vn",
    };
  }

  const data = result.recordset[0];
  return {
    thesisId: data.thesisId,
    thesisTitle: data.thesisTitle,
    advisorName: data.advisorName || "Đang chờ phân công",
    status: data.status,
    systemMessage: "Chào mừng bạn quay lại hệ thống Workspace!",
    supportEmail: "support@ptit.edu.vn",
  };
};

// =========================================================================
// 2. PROFILE
// =========================================================================

const getProfile = async (userId) => {
  const pool = await poolPromise;

  const profileResult = await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT
        u.id, u.name, u.email, u.role,
        up.phone,
        up.student_code,
        c.class_name,
        c.id AS class_id,
        t.id AS thesis_id,
        t.title AS thesis_title,
        t.lecturer_status,
        t.admin_status,
        l.name AS lecturer_name
      FROM Users u
      LEFT JOIN UserProfiles up ON u.id = up.user_id
      LEFT JOIN ClassStudents cs ON u.id = cs.student_id
      LEFT JOIN Classes c ON cs.class_id = c.id
      LEFT JOIN (
        SELECT TOP 1 id, student_id, lecturer_id, title, lecturer_status, admin_status, created_at
        FROM Thesis
        WHERE student_id = @userId
          AND (status IS NULL OR status <> 'forum')
          AND title NOT LIKE 'DIEN_DAN_CHUNG_LOP_%'
        ORDER BY
          CASE WHEN admin_status = 'approved' AND lecturer_status = 'approved' THEN 0 ELSE 1 END,
          created_at DESC
      ) t ON u.id = t.student_id
      LEFT JOIN Users l ON t.lecturer_id = l.id
      WHERE u.id = @userId AND u.role = 'student'
    `);

  const profile = profileResult.recordset[0];
  if (!profile) return null;

  // Fallback mã sinh viên từ email nếu chưa có
  let studentCode = profile.student_code || "Chưa cập nhật";
  if (studentCode === "Chưa cập nhật" && profile.email) {
    studentCode = profile.email.split("@")[0].toUpperCase();
  }

  // Tính % tiến độ dựa trên milestones
  let progressPercentage = 0;
  if (profile.thesis_id) {
    const progressResult = await pool
      .request()
      .input("thesisId", sql.Int, profile.thesis_id)
      .query(`
        SELECT
          COUNT(id) AS total_milestones,
          SUM(CASE WHEN status = 'completed' OR status = 'graded' THEN 1 ELSE 0 END) AS completed_milestones
        FROM Milestones
        WHERE thesis_id = @thesisId
      `);

    const { total_milestones, completed_milestones } = progressResult.recordset[0];
    if (total_milestones > 0) {
      progressPercentage = Math.round((completed_milestones / total_milestones) * 100);
    }
  }

  return {
    ...profile,
    student_code: studentCode,
    phone: profile.phone || "",
    progress_percentage: progressPercentage,
  };
};

const updateProfile = async (userId, data) => {
  const pool = await poolPromise;
  const { phone } = data;

  await pool
    .request()
    .input("userId", sql.Int, userId)
    .input("phone", sql.NVarChar, phone || null)
    .query(`
      MERGE UserProfiles AS target
      USING (SELECT @userId AS user_id) AS source
      ON (target.user_id = source.user_id)
      WHEN MATCHED THEN
        UPDATE SET phone = @phone, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (user_id, phone, updated_at)
        VALUES (@userId, @phone, GETDATE());
    `);

  return { success: true };
};

// =========================================================================
// 3. GIẢNG VIÊN & GỢI Ý ĐỀ TÀI
// =========================================================================

const getLecturers = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT u.id, u.name, u.email, u.phone, u.degree, u.domain
    FROM Users u
    WHERE u.role = 'lecturer'
    ORDER BY u.name
  `);
  return result.recordset;
};

const getSuggestedTopics = async ({ lecturerId, status = "open" }) => {
  const pool = await poolPromise;
  const req = pool.request().input("status", sql.NVarChar, status);

  let query = `
    SELECT ts.*, u.name AS lecturer_name
    FROM TopicSuggestions ts
    LEFT JOIN Users u ON ts.lecturer_id = u.id
    WHERE ts.status = @status
  `;

  if (lecturerId) {
    req.input("lecturerId", sql.Int, parseInt(lecturerId));
    query += ` AND ts.lecturer_id = @lecturerId`;
  }

  query += ` ORDER BY ts.created_at DESC`;
  const result = await req.query(query);
  return result.recordset;
};

// =========================================================================
// 4. ĐĂNG KÝ ĐỀ TÀI
// =========================================================================

const submitRegistration = async ({ title, description, domain, lecturer_id, suggestion_id, session_id, student_id }) => {
  const pool = await poolPromise;

  // Chỉ chặn nếu đề tài CHƯA bị từ chối
  const existing = await pool
    .request()
    .input("studentId", sql.Int, student_id)
    .query(`
      SELECT id FROM Thesis
      WHERE student_id = @studentId
        AND admin_status <> 'rejected'
        AND lecturer_status <> 'rejected'
    `);

  if (existing.recordset.length > 0) {
    throw new Error("Bạn đã đăng ký đề tài rồi. Đề tài đang chờ duyệt hoặc đã được duyệt.");
  }

  // Tự động lấy session đang hoạt động nếu không truyền lên
  let resolvedSessionId = session_id ? parseInt(session_id) : null;
  if (!resolvedSessionId) {
    const sessionRes = await pool
      .request()
      .query("SELECT TOP 1 id FROM Sessions WHERE is_active = 1 ORDER BY created_at DESC");
    resolvedSessionId = sessionRes.recordset[0]?.id || null;
  }

  const insertResult = await pool
    .request()
    .input("studentId",   sql.Int,      student_id)
    .input("lecturerId",  sql.Int,      lecturer_id)
    .input("title",       sql.NVarChar, title)
    .input("description", sql.NVarChar, description || "")
    .input("domain",      sql.NVarChar, domain || "")
    .input("suggestionId",sql.Int,      suggestion_id || null)
    .input("sessionId",   sql.Int,      resolvedSessionId)
    .query(`
      INSERT INTO Thesis
        (student_id, lecturer_id, title, description, domain,
         suggestion_id, session_id, status, lecturer_status, admin_status, created_at, updated_at)
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.lecturer_id
      VALUES
        (@studentId, @lecturerId, @title, @description, @domain,
         @suggestionId, @sessionId, 'registered', 'pending', 'pending', GETDATE(), GETDATE())
    `);

  const newThesis = insertResult.recordset[0];

  // Gửi thông báo cho giảng viên
  if (newThesis && lecturer_id) {
    try {
      await notificationService.createNotification({
        user_id: lecturer_id,
        type: "thesis_registered",
        title: "Sinh viên đăng ký đề tài mới",
        message: `Sinh viên vừa đăng ký đề tài: "${title}"`,
        ref_type: "Thesis",
        ref_id: newThesis.id,
      });
    } catch (notifyErr) {
      console.error("Lỗi gửi thông báo đăng ký đề tài:", notifyErr.message);
    }
  }

  return newThesis;
};

// =========================================================================
// 5. LẤY ĐỀ TÀI CỦA SINH VIÊN HIỆN TẠI (kèm milestones)
// =========================================================================

const getMyThesis = async (studentId) => {
  const pool = await poolPromise;

  const result = await pool
    .request()
    .input("studentId", sql.Int, studentId)
    .query(`
      SELECT TOP 1
        t.id AS thesisId,
        t.id AS thesis_id,
        t.title,
        t.description,
        t.domain,
        t.lecturer_status,
        t.admin_status,
        t.status,
        t.reject_reason,
        t.final_score,
        t.created_at,
        u.id AS lecturer_id,
        u.name AS lecturer_name,
        u.email AS lecturer_email,
        CASE
          WHEN t.admin_status = 'rejected' OR t.lecturer_status = 'rejected' THEN 'rejected'
          WHEN t.admin_status = 'approved' AND t.lecturer_status = 'approved' THEN 'approved'
          ELSE 'pending'
        END AS approval_status
      FROM Thesis t
      LEFT JOIN Users u ON t.lecturer_id = u.id
      WHERE t.student_id = @studentId
        AND (t.status IS NULL OR t.status <> 'forum')
        AND t.title NOT LIKE 'DIEN_DAN_CHUNG_LOP_%'
      ORDER BY
        CASE WHEN t.admin_status = 'approved' AND t.lecturer_status = 'approved' THEN 0 ELSE 1 END,
        t.created_at DESC
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const thesis = result.recordset[0];

  const milestonesRes = await pool
    .request()
    .input("thesisId", sql.Int, thesis.thesisId)
    .query(`
      SELECT id, title, description, deadline, status, created_at
      FROM Milestones
      WHERE thesis_id = @thesisId
      ORDER BY created_at ASC
    `);

  return {
    ...thesis,
    milestones: milestonesRes.recordset,
  };
};

// =========================================================================
// EXPORTS
// =========================================================================

module.exports = {
  getStudentDashboard,
  getProfile,
  updateProfile,
  getLecturers,
  getSuggestedTopics,
  submitRegistration,
  getMyThesis,
};