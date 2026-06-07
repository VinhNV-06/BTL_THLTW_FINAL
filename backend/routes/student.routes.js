const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload.middleware");

const studentController = require("../controllers/student.controller");
const progressController = require("../controllers/progress.controller");

router.use(auth);

// 1. DASHBOARD
router.get("/dashboard", studentController.getStudentDashboard);

// 2. PROFILE
router.get("/profile", studentController.getProfile);
router.put("/profile", studentController.updateProfile);

// 3. MY THESIS - Lấy đề tài + milestones của sinh viên hiện tại
router.get("/my-thesis", studentController.getMyThesis);

// 3. MILESTONES
router.get("/theses/:thesisId/milestones", progressController.getMilestones);
router.post("/milestones", progressController.createMilestone);
router.patch("/milestones/:id", progressController.updateMilestone);

// 4. PROGRESS
router.get("/theses/:thesisId/progress", progressController.getThesisProgress);
router.post(
  "/progress",
  upload.single("file"),
  progressController.submitProgress,
);
router.delete("/submissions/:id", progressController.deleteSubmission);

router.get("/lecturers", studentController.getLecturers);
router.get("/topics", studentController.getSuggestedTopics);
router.post("/thesis/register", studentController.submitRegistration);

module.exports = router;
