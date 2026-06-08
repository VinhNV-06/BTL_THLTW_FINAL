const lecturerThesisService = require("../services/lecturerThesis.service");
const lecturerService = require("../services/lecturer.service");
const milestoneService = require("../services/milestone.service");
const notificationService = require("../services/notification.service");
const auditService = require("../services/audit.service");


exports.approveThesis = async (req, res) => {
  const { id } = req.params;
  const { lecturerNote } = req.body;
  const lecturerId = req.user?.id;

  const isOwner = await lecturerThesisService.verifyThesisOwnership(id, lecturerId);
  if (!isOwner) {
    return res.status(403).json({ message: "Bạn không có quyền duyệt đề tài này" });
  }

  try {
    const result = await lecturerThesisService.approveThesis(id, lecturerNote);

    const thesisInfo = await lecturerThesisService.getThesisNotificationInfo(id);
    if (thesisInfo) {
      await notificationService.createNotification({
        user_id: thesisInfo.student_id,
        type: "thesis_approved",
        title: "Đề tài đã được duyệt",
        message: `Đề tài "${thesisInfo.title}" đã được Giảng viên duyệt. Vui lòng chuẩn bị nộp tiến độ theo quy trình.`,
        ref_type: "thesis",
        ref_id: parseInt(id)
      });

      await auditService.logAction({
        actor_id: lecturerId,
        actor_name: req.user?.name || req.user?.email,
        action: "APPROVE",
        target_table: "Thesis",
        target_id: parseInt(id),
        new_value: { lecturer_status: "approved", lecturer_note: lecturerNote }
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi duyệt đề tài", error: err.message });
  }
};

exports.rejectThesis = async (req, res) => {
  const { id } = req.params;
  const { rejectReason } = req.body;
  const lecturerId = req.user?.id;

  if (!rejectReason) return res.status(400).json({ message: "Cần nhập lý do từ chối" });

  const isOwner = await lecturerThesisService.verifyThesisOwnership(id, lecturerId);
  if (!isOwner) {
    return res.status(403).json({ message: "Bạn không có quyền từ chối đề tài này" });
  }

  try {
    const result = await lecturerThesisService.rejectThesis(id, rejectReason);

    const thesisInfo = await lecturerThesisService.getThesisNotificationInfo(id);
      
    if (thesisInfo) {
      const { student_id, title } = thesisInfo;
      await notificationService.createNotification({
        user_id: student_id,
        type: "thesis_rejected",
        title: "Đề tài bị từ chối",
        message: `Đề tài "${title}" đã bị Giảng viên từ chối. Lý do: ${rejectReason}`,
        ref_type: "thesis",
        ref_id: parseInt(id)
      });

      await auditService.logAction({
        actor_id: lecturerId,
        actor_name: req.user?.name || req.user?.email,
        action: "REJECT",
        target_table: "Thesis",
        target_id: parseInt(id),
        new_value: { lecturer_status: "rejected", reject_reason: rejectReason }
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi từ chối đề tài", error: err.message });
  }
};

exports.finalizeThesis = async (req, res) => {
  const { id } = req.params;
  const { finalScore } = req.body;
  const lecturerId = req.user?.id;

  if (finalScore === undefined) return res.status(400).json({ message: "Thiếu điểm tổng kết" });

  const isOwner = await lecturerThesisService.verifyThesisOwnership(id, lecturerId);
  if (!isOwner) {
    return res.status(403).json({ message: "Bạn không có quyền kết thúc đề tài này" });
  }

  try {
    const result = await lecturerThesisService.finalizeThesis(id, finalScore);

    const thesisInfo = await lecturerThesisService.getThesisNotificationInfo(id);
    if (thesisInfo) {
      await notificationService.createNotification({
        user_id: thesisInfo.student_id,
        type: "thesis_finalized",
        title: "Đồ án đã hoàn thành",
        message: `Đề tài "${thesisInfo.title}" đã được Giảng viên kết thúc và chấm điểm tổng kết: ${finalScore}.`,
        ref_type: "thesis",
        ref_id: parseInt(id)
      });

      await auditService.logAction({
        actor_id: lecturerId,
        actor_name: req.user?.name || req.user?.email,
        action: "FINALIZE",
        target_table: "Thesis",
        target_id: parseInt(id),
        new_value: { final_score: finalScore, status: "completed" }
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi kết thúc đề tài", error: err.message });
  }
};

exports.getLecturerTheses = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "lecturer") {
      return res.status(403).json({ message: "Chỉ giảng viên mới được truy cập" });
    }

    const lecturerId = req.user.id;
    const { keyword, status, class_id, session_id, page = 1, pageSize = 10 } = req.query;

    const data = await lecturerThesisService.getLecturerTheses({
      lecturerId,
      keyword,
      status,
      class_id: class_id ? parseInt(class_id) : null,
      session_id: session_id ? parseInt(session_id) : null,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách đề tài", error: err.message });
  }
};

exports.getThesisDetail = async (req, res) => {
  const { id } = req.params;
  const lecturerId = req.user?.id;

  try {
    const data = await lecturerThesisService.getThesisDetail(id, lecturerId);
    res.json(data);
  } catch (err) {
    res.status(403).json({ message: err.message || "Lỗi khi lấy chi tiết đề tài" });
  }
};

exports.createMilestone = async (req, res) => {
  const rawThesisId = req.body.thesis_id ?? req.body.thesisId;
  const thesis_id = parseInt(rawThesisId, 10);
  const lecturerId = req.user?.id;

  if (!rawThesisId || isNaN(thesis_id) || thesis_id <= 0) {
    return res.status(400).json({ message: "Thiếu hoặc sai định dạng thesis_id. Vui lòng chọn đề tài hợp lệ!" });
  }

  const isOwner = await lecturerThesisService.verifyThesisOwnership(thesis_id, lecturerId);
  if (!isOwner) {
    return res.status(403).json({ message: "Bạn không có quyền thêm mốc cho đề tài này" });
  }

  try {
    const payload = { ...req.body, thesis_id, created_by: lecturerId };
    const data = await milestoneService.createMilestone(payload);

    await lecturerService.logAudit({
      actor_id: lecturerId,
      actor_name: req.user?.name || req.user?.email,
      action: "CREATE_MILESTONE",
      target_table: "Milestones",
      target_id: data?.id,
      new_value: payload
    });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tạo Milestone", error: err.message });
  }
};

exports.bulkApproveTheses = async (req, res) => {
  const { thesisIds } = req.body;
  const lecturerId = req.user?.id;

  if (!Array.isArray(thesisIds) || thesisIds.length === 0) {
    return res.status(400).json({ message: "Danh sách đề tài không hợp lệ" });
  }

  try {
    const results = [];
    for (const rawId of thesisIds) {
      const id = parseInt(rawId);
      if (isNaN(id)) {
        results.push({ id: rawId, success: false, error: "ID không hợp lệ" });
        continue;
      }

      const isOwner = await lecturerThesisService.verifyThesisOwnership(id, lecturerId);
      if (isOwner) {
        await lecturerThesisService.approveThesis(id);

        const info = await lecturerThesisService.getThesisNotificationInfo(id);
        if (info && info.student_id) {
          await notificationService.createNotification({
            user_id: info.student_id,
            type: "thesis_approved",
            title: "Đề tài đã được duyệt",
            message: `Đề tài "${info.title}" đã được duyệt (bulk action).`,
            ref_type: "thesis",
            ref_id: id
          });
        }

        await auditService.logAction({
          actor_id: lecturerId,
          actor_name: req.user?.name || req.user?.email,
          action: "BULK_APPROVE",
          target_table: "Thesis",
          target_id: id
        });
        results.push({ id, success: true });
      } else {
        results.push({ id, success: false, error: "Không có quyền" });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: "Lỗi bulk approve", error: err.message });
  }
};

exports.bulkRejectTheses = async (req, res) => {
  const { thesisIds, rejectReason } = req.body;
  const lecturerId = req.user?.id;

  if (!Array.isArray(thesisIds) || thesisIds.length === 0) {
    return res.status(400).json({ message: "Danh sách đề tài không hợp lệ" });
  }
  if (!rejectReason) {
    return res.status(400).json({ message: "Cần lý do từ chối" });
  }

  try {
    const results = [];
    for (const rawId of thesisIds) {
      const id = parseInt(rawId);
      if (isNaN(id)) {
        results.push({ id: rawId, success: false, error: "ID không hợp lệ" });
        continue;
      }

      const isOwner = await lecturerThesisService.verifyThesisOwnership(id, lecturerId);
      if (isOwner) {
        await lecturerThesisService.rejectThesis(id, rejectReason);

        const info = await lecturerThesisService.getThesisNotificationInfo(id);
        if (info && info.student_id) {
          await notificationService.createNotification({
            user_id: info.student_id,
            type: "thesis_rejected",
            title: "Đề tài bị từ chối",
            message: `Đề tài "${info.title}" đã bị từ chối (bulk). Lý do: ${rejectReason}`,
            ref_type: "thesis",
            ref_id: id
          });
        }

        await auditService.logAction({
          actor_id: lecturerId,
          actor_name: req.user?.name || req.user?.email,
          action: "BULK_REJECT",
          target_table: "Thesis",
          target_id: id,
          new_value: { reject_reason: rejectReason }
        });
        results.push({ id, success: true });
      } else {
        results.push({ id, success: false, error: "Không có quyền" });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: "Lỗi bulk reject", error: err.message });
  }
};
