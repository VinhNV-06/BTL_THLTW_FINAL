const studentService = require("../services/student.service");

// =========================================================================
// 1. DASHBOARD
// =========================================================================

const getStudentDashboard = async (req, res) => {
  if (!req.user || req.user.role !== "student") {
    return res.status(403).json({ message: "Chỉ sinh viên mới được truy cập" });
  }
  try {
    const data = await studentService.getStudentDashboard(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy dữ liệu Dashboard", error: err.message });
  }
};

// =========================================================================
// 2. PROFILE
// =========================================================================

const getProfile = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Chưa đăng nhập" });
  try {
    const profile = await studentService.getProfile(req.user.id);
    if (!profile) return res.status(404).json({ message: "Không tìm thấy thông tin" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server", error: err.message });
  }
};

const updateProfile = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Chưa đăng nhập" });
  try {
    await studentService.updateProfile(req.user.id, req.body);
    res.json({ message: "Cập nhật hồ sơ thành công!" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi Server", error: err.message });
  }
};

// =========================================================================
// 3. GIẢNG VIÊN & GỢI Ý ĐỀ TÀI
// =========================================================================

const getLecturers = async (req, res) => {
  try {
    const data = await studentService.getLecturers();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSuggestedTopics = async (req, res) => {
  try {
    const { lecturerId, status } = req.query;
    const data = await studentService.getSuggestedTopics({ lecturerId, status });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================================================================
// 4. ĐĂNG KÝ ĐỀ TÀI
// =========================================================================

const submitRegistration = async (req, res) => {
  const { title, description, domain, lecturer_id, suggestion_id, session_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Thiếu tiêu đề đề tài" });
  }
  if (!lecturer_id) {
    return res.status(400).json({ error: "Thiếu thông tin giảng viên hướng dẫn (lecturer_id)" });
  }

  try {
    const newThesis = await studentService.submitRegistration({
      title,
      description,
      domain,
      lecturer_id,
      suggestion_id,
      session_id,
      student_id: req.user.id,
    });
    res.json({ success: true, message: "Đăng ký đề tài thành công", thesisId: newThesis?.id });
  } catch (err) {
    const status = err.message.includes("đã đăng ký") ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};

// =========================================================================
// 5. LẤY ĐỀ TÀI CỦA SINH VIÊN HIỆN TẠI (kèm milestones)
// =========================================================================

const getMyThesis = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Chưa đăng nhập" });
  try {
    const thesis = await studentService.getMyThesis(req.user.id);
    if (!thesis) return res.json({ thesis: null, message: "Chưa có đề tài" });
    res.json({ thesis });
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy thông tin đề tài", error: err.message });
  }
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
