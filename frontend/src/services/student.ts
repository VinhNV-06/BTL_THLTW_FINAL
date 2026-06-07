import { apiRequest } from "@/services/api"; // 🔥 ĐÃ ĐỔI: Gọi hàm core để tự động cấu hình URL .env và kẹp Token bảo mật

interface StudentProfileResponse {
  name: string;
  student_code: string;
  email: string;
  class_name?: string;
  phone?: string;
  thesis_id?: number | null;
  thesis_title?: string;
  lecturer_name?: string;
  progress_percentage?: number;
}

interface ProfileUpdatePayload {
  phone: string;
}

// ==============================================================
// ĐƠN VỊ CÁC HÀM API PROFILE SINH VIÊN ĐÃ ĐƯỢC CHUẨN HÓA KHÓA CORE
// ==============================================================

/**
 * Lấy thông tin hồ sơ chi tiết của sinh viên hiện tại
 */
export const getStudentProfile = async (): Promise<StudentProfileResponse> => {
  // Đổi sang apiRequest để tự động kẹp token và nối URL gốc từ .env khi lên Netlify
  return apiRequest<StudentProfileResponse>("/api/student/profile", {
    method: "GET",
  });
};

/**
 * Cập nhật số điện thoại liên lạc trong hồ sơ sinh viên
 */
export const updateStudentProfile = async (
  data: ProfileUpdatePayload,
): Promise<unknown> => {
  return apiRequest("/api/student/profile", {
    method: "PUT",
    data,
  });
};
