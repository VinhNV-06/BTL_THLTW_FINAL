import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Modal,
  Form,
  message,
  Spin,
} from "antd";
import {
  FormOutlined,
  CheckCircleFilled,
  ExclamationCircleOutlined,
  SyncOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useModel, request } from "umi";
import type {
  LecturerERD,
  TopicSuggestionERD,
  ThesisStatus,
} from "../../../types/StudentTypes/RegistrationTypes";
import { thesisRegistrationService } from "../../../services/thesis";

import StudentStatusBanner from "../components/StudentStatusBanner";
import StudentHeader from "../components/StudentHeader";
import AdvisorCard from "./components/AdvisorCard";
import RegistrationForm from "./components/RegistrationForm";
import RegistrationProcess from "./components/RegistrationProcess";

// 🔥 ĐÃ SỬA: Khai báo giải phóng cả Title và Text từ Typography để dập tắt lỗi ReferenceError
const { Title, Text } = Typography;

// --- Định cấu trúc Interface chi tiết cho các Đối tượng ---
interface StatusMetaConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  description: string;
}

interface RegistrationFormFields {
  suggestion_id?: number;
  lecturer_id: number;
  title: string;
  domain: string;
  description: string;
  session_id?: number;
}

interface DashboardApiResponse {
  status?: string;
  data?: {
    status?: string;
  };
}

const statusMeta: Record<ThesisStatus, StatusMetaConfig> = {
  not_registered: {
    label: "Chưa đăng ký",
    color: "#8c8c8c",
    bg: "#fafafa",
    icon: <FormOutlined />,
    description: "Bạn chưa nộp phiếu đăng ký đề tài nào.",
  },
  pending: {
    label: "Chờ xét duyệt",
    color: "#fa8c16",
    bg: "#fff7e6",
    icon: <SyncOutlined spin />,
    description: "Phiếu đăng ký đang chờ Giảng viên và Bộ môn xét duyệt.",
  },
  approved: {
    label: "Đã duyệt đề tài",
    color: "#52c41a",
    bg: "#f6ffed",
    icon: <CheckCircleFilled />,
    description: "Đề tài của bạn đã được duyệt. Hãy bắt đầu thực hiện!",
  },
  rejected: {
    label: "Bị từ chối",
    color: "#ff4d4f",
    bg: "#fff2f0",
    icon: <ExclamationCircleOutlined />,
    description: "Đề tài bị từ chối. Vui lòng xem lý do và đăng ký lại.",
  },
};

const ThesisRegistrationPage: React.FC = () => {
  const { initialState } = useModel("@@initialState");
  const currentUser = initialState?.currentUser;

  const [form] = Form.useForm<RegistrationFormFields>();
  const [status, setStatus] = useState<ThesisStatus>("not_registered");
  const [myLecturer, setMyLecturer] = useState<LecturerERD | undefined>(
    undefined,
  );
  const [suggestedTopics, setSuggestedTopics] = useState<TopicSuggestionERD[]>(
    [],
  );
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const daysLeft = 14;

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoadingInitial(true);
        const token = localStorage.getItem("token");

        // 1. Kiểm tra trạng thái đăng ký thực tế từ Backend
        let actualStatus: ThesisStatus = "not_registered";
        if (token) {
          try {
            const dashboardRes = (await request("student/dashboard", {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            })) as DashboardApiResponse;

            actualStatus = (dashboardRes?.data?.status ||
              dashboardRes?.status ||
              "not_registered") as ThesisStatus;
            setStatus(actualStatus);
          } catch (err) {
            console.error("Lỗi khi kiểm tra trạng thái đề tài:", err);
          }
        }

        // 2. Tải danh sách giảng viên và gợi ý đề tài kèm BƯỚC PHÒNG THỦ MẢNG
        const lecturersData = await thesisRegistrationService.getLecturers();
        const lecturers = Array.isArray(lecturersData)
          ? (lecturersData as LecturerERD[])
          : [];
        const firstLecturer = lecturers[0];

        let tops: TopicSuggestionERD[] = [];
        if (firstLecturer?.id) {
          const topsData = await thesisRegistrationService.getSuggestedTopics(
            firstLecturer.id,
          );
          tops = Array.isArray(topsData)
            ? (topsData as TopicSuggestionERD[])
            : [];
        }

        setMyLecturer(firstLecturer);
        setSuggestedTopics(tops);

        if (firstLecturer) {
          form.setFieldsValue({ lecturer_id: firstLecturer.id });
        }

        // 3. Điền bản nháp từ localStorage nếu sinh viên chưa nộp đơn
        const draftData = localStorage.getItem("thesis_registration_draft");
        if (draftData && actualStatus === "not_registered") {
          try {
            const parsedData = JSON.parse(
              draftData,
            ) as Partial<RegistrationFormFields>;
            form.setFieldsValue({
              ...parsedData,
              lecturer_id: firstLecturer?.id,
            });
          } catch (err) {
            console.error("Lỗi parse dữ liệu nháp:", err);
          }
        }
      } catch (error: unknown) {
        console.error("Failed to load initial registration parameters:", error);
        void message.error("Không thể tải dữ liệu ban đầu. Vui lòng thử lại.");
      } finally {
        setLoadingInitial(false);
      }
    };

    void fetchData();
  }, [form]);

  const handleSaveDraft = (): void => {
    localStorage.setItem(
      "thesis_registration_draft",
      JSON.stringify(form.getFieldsValue()),
    );
    void message.success("Đã lưu nháp!");
  };

  const handleSelectSuggested = (topic: TopicSuggestionERD): void => {
    form.setFieldsValue({
      title: topic.title,
      description: topic.description,
      lecturer_id: topic.lecturer_id || myLecturer?.id || 0,
      suggestion_id: topic.id,
      session_id: topic.session_id,
    });
    void message.success("Đã điền tự động thông tin từ gợi ý của Giảng viên!");
  };

  const handleFormSubmit = (values: RegistrationFormFields): void => {
    console.log(">>> Dữ liệu form lấy được:", values);
    const studentId = currentUser?.id;

    if (!studentId) {
      void message.error(
        "Lỗi: Không tìm thấy thông tin tài khoản! Vui lòng Đăng xuất và Đăng nhập lại.",
      );
      return;
    }

    Modal.confirm({
      title: "Xác nhận nộp phiếu",
      content:
        "Không thể sửa đổi thông tin sau khi nộp. Bạn có chắc chắn muốn gửi yêu cầu?",
      onOk: async () => {
        setIsSubmitting(true);
        try {
          const allFormValues = form.getFieldsValue();
          const payload = {
            ...allFormValues,
            student_id: studentId,
          };

          await thesisRegistrationService.submitRegistration(payload);

          localStorage.removeItem("thesis_registration_draft");
          setStatus("pending");
          void message.success("Đã gửi phiếu đăng ký thành công!");
        } catch (error: unknown) {
          console.error(">>> LỖI GỬI FORM (CHI TIẾT):", error);
          void message.error("Có lỗi xảy ra khi nộp phiếu!");
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const meta = statusMeta[status] || statusMeta.not_registered;

  return (
    <Spin spinning={loadingInitial} tip="Đang tải dữ liệu...">
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #f8faff 0%, #eef3ff 50%, #f2f8ff 100%)",
          padding: "24px",
          fontFamily: "'Plus Jakarta Sans', 'Be Vietnam Pro', sans-serif",
        }}
      >
        <StudentHeader />

        <StudentStatusBanner
          icon={meta.icon}
          label={meta.label}
          description={meta.description}
          color={meta.color}
          bg={meta.bg}
        >
          <div style={{ textAlign: "center" }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#1677ff",
                display: "block",
              }}
            >
              {daysLeft}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              ngày tới hạn
            </Text>
          </div>
          <div
            style={{ width: 1, height: 40, background: "rgba(0,0,0,0.06)" }}
          />
          <div style={{ textAlign: "center" }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#722ed1",
                display: "block",
              }}
            >
              Học kỳ 2
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Năm học 2025-2026
            </Text>
          </div>
        </StudentStatusBanner>

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={16}>
            <RegistrationForm
              form={form}
              status={status}
              myLecturer={myLecturer}
              onSubmit={handleFormSubmit}
              onSaveDraft={handleSaveDraft}
              isSubmitting={isSubmitting}
            />

            {status === "not_registered" && (
              <Card
                bordered={false}
                style={{ borderRadius: 16, border: "1px solid #f0f0f0" }}
              >
                <Title
                  level={5}
                  style={{
                    marginBottom: 20,
                    fontSize: "16px",
                    color: "#1a1a2e",
                  }}
                >
                  <SearchOutlined
                    style={{ marginRight: 8, color: "#1677ff" }}
                  />{" "}
                  Gợi ý đề tài từ Giảng viên
                </Title>
                <Row gutter={[16, 16]}>
                  {/* 🔥 ĐÃ SỬA: Bọc kiểm tra mảng phòng thủ trước khi duyệt .map danh sách gợi ý đề tài */}
                  {Array.isArray(suggestedTopics) &&
                    suggestedTopics.map((topic) => (
                      <Col xs={24} md={12} key={topic.id}>
                        <Card
                          style={{
                            borderRadius: 12,
                            cursor: "pointer",
                            height: "100%",
                          }}
                          hoverable
                          onClick={() => handleSelectSuggested(topic)}
                        >
                          <Tag
                            color="blue"
                            style={{
                              borderRadius: 4,
                              border: "none",
                              fontWeight: 600,
                            }}
                          >
                            {topic.domain || "Đề tài"}
                          </Tag>
                          <Text
                            strong
                            style={{
                              display: "block",
                              marginTop: 12,
                              color: "#1a1a2e",
                              fontSize: "14px",
                            }}
                          >
                            {topic.title}
                          </Text>
                          <Text
                            type="secondary"
                            style={{
                              fontSize: 12,
                              display: "block",
                              marginTop: 8,
                            }}
                          >
                            {topic.description}
                          </Text>
                        </Card>
                      </Col>
                    ))}
                  {(!Array.isArray(suggestedTopics) ||
                    suggestedTopics.length === 0) && (
                    <Col span={24}>
                      <Text type="secondary">
                        Chưa có đề tài gợi ý nào từ giảng viên này.
                      </Text>
                    </Col>
                  )}
                </Row>
              </Card>
            )}
          </Col>

          <Col xs={24} xl={8}>
            <AdvisorCard advisor={myLecturer} />
            <RegistrationProcess status={status} />
          </Col>
        </Row>
      </div>
    </Spin>
  );
};

export default ThesisRegistrationPage;
