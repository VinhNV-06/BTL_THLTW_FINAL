const { poolPromise, sql } = require("../config/db");

exports.getMyProposals = async (lecturerId) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("lecturerId", sql.Int, lecturerId)
    .query(`
      SELECT 
        ts.id,
        ts.session_id,
        ts.title,
        ts.description,
        ts.max_groups,
        ts.status,
        ts.created_at,
        ts.updated_at,
        s.name AS session_name,
        COUNT(DISTINCT t.id) AS registration_count
      FROM TopicSuggestions ts
      LEFT JOIN Sessions s ON ts.session_id = s.id
      LEFT JOIN Thesis t ON ts.id = t.suggestion_id
        AND t.admin_status <> 'rejected'
        AND t.lecturer_status <> 'rejected'
      WHERE ts.lecturer_id = @lecturerId
      GROUP BY ts.id, ts.session_id, ts.title, ts.description, ts.max_groups, ts.status, ts.created_at, ts.updated_at, s.name
      ORDER BY ts.created_at DESC
    `);
  return result.recordset;
};

exports.createProposal = async (data) => {
  const { lecturer_id, title, description, max_groups, status } = data;
  let { session_id } = data;
  const pool = await poolPromise;

  // Nếu không có session_id → tự động lấy session đang active
  if (!session_id) {
    const sessionRes = await pool
      .request()
      .query("SELECT TOP 1 id FROM Sessions WHERE is_active = 1 ORDER BY created_at DESC");
    session_id = sessionRes.recordset[0]?.id || null;
  }

  if (!session_id) {
    throw new Error("Không tìm thấy đợt đăng ký nào đang hoạt động. Vui lòng liên hệ Admin!");
  }

  const result = await pool
    .request()
    .input("session_id", sql.Int, session_id)
    .input("lecturer_id", sql.Int, lecturer_id)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description || null)
    .input("max_groups", sql.Int, max_groups || 1)
    .input("status", sql.NVarChar, status || "open")
    .query(`
      INSERT INTO TopicSuggestions (session_id, lecturer_id, title, description, max_groups, status, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@session_id, @lecturer_id, @title, @description, @max_groups, @status, GETDATE(), GETDATE())
    `);
  return result.recordset[0];
};

exports.updateProposal = async (id, data, lecturerId) => {
  const { title, description, max_groups, status, session_id } = data;
  const pool = await poolPromise;

  const ownerCheck = await pool
    .request()
    .input("id", sql.Int, id)
    .input("lecturerId", sql.Int, lecturerId)
    .query("SELECT id FROM TopicSuggestions WHERE id = @id AND lecturer_id = @lecturerId");

  if (ownerCheck.recordset.length === 0) {
    throw new Error("Bạn không có quyền sửa đề tài đề xuất này");
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("title", sql.NVarChar, title || null)
    .input("description", sql.NVarChar, description || null)
    .input("max_groups", sql.Int, max_groups || null)
    .input("status", sql.NVarChar, status || null)
    .input("session_id", sql.Int, session_id || null)
    .query(`
      UPDATE TopicSuggestions
      SET 
        title = ISNULL(@title, title),
        description = ISNULL(@description, description),
        max_groups = ISNULL(@max_groups, max_groups),
        status = ISNULL(@status, status),
        session_id = ISNULL(@session_id, session_id),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0];
};

exports.deleteProposal = async (id, lecturerId) => {
  const pool = await poolPromise;

  const ownerCheck = await pool
    .request()
    .input("id", sql.Int, id)
    .input("lecturerId", sql.Int, lecturerId)
    .query("SELECT id FROM TopicSuggestions WHERE id = @id AND lecturer_id = @lecturerId");

  if (ownerCheck.recordset.length === 0) {
    throw new Error("Bạn không có quyền xóa đề tài đề xuất này");
  }

  const usedCheck = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT TOP 1 id FROM Thesis
      WHERE suggestion_id = @id
        AND admin_status <> 'rejected'
        AND lecturer_status <> 'rejected'
    `);

  if (usedCheck.recordset.length > 0) {
    throw new Error("Không thể xóa vì đề tài này đã có sinh viên đăng ký");
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM TopicSuggestions WHERE id = @id");

  return { success: true };
};

exports.getProposalRegistrations = async (proposalId) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("proposalId", sql.Int, proposalId)
    .query(`
      SELECT 
        t.id,
        t.title,
        u.id AS student_id,
        u.name AS student_name,
        u.email,
        u.phone,
        t.lecturer_status,
        t.admin_status,
        t.created_at
      FROM Thesis t
      JOIN Users u ON t.student_id = u.id
      WHERE t.suggestion_id = @proposalId
      ORDER BY t.created_at DESC
    `);
  return result.recordset;
};
