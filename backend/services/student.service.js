const { poolPromise, sql } = require("../config/db");

const getStudentDashboard = async (studentId) => {
  const pool = await poolPromise;
  
  const result = await pool.request()
    .input("studentId", sql.Int, studentId)
    .query(`
      SELECT 
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
      ORDER BY t.created_at DESC
    `);

  // Nếu sinh viên chưa có đề tài (thesisId = null hoặc recordset rỗng)
  if (result.recordset.length === 0 || !result.recordset[0].thesisId) {
    const advisorResult = await pool.request()
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT TOP 1 u.name AS advisorName
        FROM ClassStudents cs
        INNER JOIN Classes c ON cs.class_id = c.id
        INNER JOIN Users u ON c.lecturer_id = u.id
        WHERE cs.student_id = @studentId
      `);

    const advisorName = advisorResult.recordset.length > 0 ? advisorResult.recordset[0].advisorName : null;

    return {
      thesisId: null, 
      thesisTitle: null,
      advisorName: advisorName,
      status: "not_registered",
      systemMessage: "Bạn chưa đăng ký đề tài khóa luận. Vui lòng vào mục đăng ký.",
      supportEmail: "support@ptit.edu.vn"
    };
  }

  // Nếu sinh viên đã có đề tài
  const data = result.recordset[0];
  return {
    thesisId: data.thesisId, 
    thesisTitle: data.thesisTitle,
    advisorName: data.advisorName || "Đang chờ phân công",
    status: data.status || "approved",
    systemMessage: "Chào mừng bạn quay lại hệ thống Workspace!",
    supportEmail: "support@ptit.edu.vn"
  };
};

// 1. Lấy thông tin Hồ sơ Sinh viên
const getProfile = async (userId) => {
  const pool = await poolPromise;
  
  const profileResult = await pool.request()
  .input("userId", sql.Int, userId)
  .query(`
    SELECT 
      u.id, u.name, u.email, u.role, 
      up.phone, -- Đã sửa: Lấy phone từ bảng UserProfiles
      up.student_code, -- Đã sửa: Lấy mã SV từ UserProfiles
      c.class_name, 
      c.id AS class_id,
      t.id AS thesis_id, 
      t.title AS thesis_title,
      l.name AS lecturer_name
    FROM Users u
    LEFT JOIN UserProfiles up ON u.id = up.user_id -- Đã sửa: JOIN với bảng UserProfiles
    LEFT JOIN ClassStudents cs ON u.id = cs.student_id
    LEFT JOIN Classes c ON cs.class_id = c.id
    LEFT JOIN Thesis t ON u.id = t.student_id
    LEFT JOIN Users l ON t.lecturer_id = l.id
    WHERE u.id = @userId AND u.role = 'student'
  `);

  const profile = profileResult.recordset[0];
  if (!profile) return null;

  // Lấy mã sinh viên từ DB trước, nếu null thì mới cắt từ email
  let studentCode = profile.student_code || 'Chưa cập nhật';
  if (studentCode === 'Chưa cập nhật' && profile.email) {
    studentCode = profile.email.split('@')[0].toUpperCase();
  }

  // Tính toán % tiến độ
  let progressPercentage = 0;
  if (profile.thesis_id) {
    const progressResult = await pool.request()
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
    phone: profile.phone || '', 
    progress_percentage: progressPercentage
  };
};

// 2. Cập nhật thông tin Hồ sơ
const updateProfile = async (userId, data) => {
  const pool = await poolPromise;
  const { phone } = data;

  try {
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("phone", sql.NVarChar, phone || null)
      .query(`
        -- Đã sửa: Update vào bảng UserProfiles thay vì Users
        UPDATE UserProfiles 
        SET phone = @phone, updated_at = GETDATE() 
        WHERE user_id = @userId
      `);
  } catch (err) {
    
    console.error("Lỗi khi cập nhật số điện thoại vào bảng UserProfiles:", err);
    throw err; 
  }
    
  return { success: true };
};

module.exports = {
  getStudentDashboard,
  getProfile,
  updateProfile
};