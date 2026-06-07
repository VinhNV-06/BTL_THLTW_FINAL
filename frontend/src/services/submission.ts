import { apiRequest } from "@/services/api"; // 🔥 ĐÃ ĐỔI: Gọi hàm core để tự động cấu hình URL .env và kẹp Token bảo mật

// Định nghĩa Enum trạng thái khớp Backend
export enum SubmissionStatus {
  SUBMITTED = "submitted",
  GRADED = "graded",
  LATE = "late",
}

export interface ISubmission {
  id: number;
  milestone_id: number;
  thesis_id: number;
  student_id: number;
  file_url: string;
  file_name: string;
  file_size?: number;
  score?: number | null; // Cập nhật null phòng thủ nếu mốc chưa có điểm
  status: SubmissionStatus;
  submitted_at: string;
}

interface SubmitPayload {
  milestone_id: number;
  thesis_id: number;
  student_id: number;
  file_name: string;
  file_url: string;
  note?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ==============================================================
// ĐƠN VỊ CÁC HÀM API SUBMISSION ĐÃ ĐƯỢC CHUẨN HÓA & KHÓA CORE
// ==============================================================

/**
 * Lấy danh sách bài nộp của sinh viên dựa trên mốc thời gian và đề tài tương ứng
 */
export const getSubmissionsByMilestone = async (
  milestoneId: number,
  thesisId: number,
): Promise<ApiResponse<ISubmission[]>> => {
  // Thay thế request bằng apiRequest để tự động kẹp Token và nhận diện URL môi trường Netlify
  return apiRequest<ApiResponse<ISubmission[]>>(`/api/submission`, {
    method: "GET",
    params: {
      milestone_id: milestoneId,
      thesis_id: thesisId,
    },
  });
};

/**
 * Sinh viên thực hiện nộp tệp tin/báo cáo minh chứng cho mốc thời gian (Milestone)
 */
export const submitMilestone = async (
  payload: FormData,
): Promise<ApiResponse<ISubmission>> => {
  return apiRequest<ApiResponse<ISubmission>>("/api/submission", {
    method: "POST",
    data: payload,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
