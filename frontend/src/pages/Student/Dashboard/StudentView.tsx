import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Alert,
  Spin,
  message,
} from "antd";
import { BookOutlined, MailOutlined, RocketOutlined } from "@ant-design/icons";
import { history, request } from "umi";

import { IStudentDashboardInfo } from "../../../types/StudentTypes/StudentDashboardTypes";

const { Text, Title } = Typography;

const StudentView: React.FC = () => {
  const [dashboardData, setDashboardData] =
    useState<IStudentDashboardInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardInfo = async (): Promise<void> => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");

        // Kẹp token vào headers để đi qua cổng bảo vệ
        const res = await request<{ data: IStudentDashboardInfo }>(
          "student/dashboard",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res && res.data) {
          setDashboardData(res.data);
        }
      } catch (error: unknown) {
        console.error("Failed to fetch student dashboard info:", error);
        void message.error("Lỗi khi tải dữ liệu dashboard");
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardInfo();
  }, []);

  const renderStatusTag = (status?: string): React.ReactNode => {
    switch (status) {
      case "not_registered":
        return <Tag color="default">Chưa đăng ký</Tag>;
      case "pending":
        return <Tag color="warning">Đang chờ duyệt</Tag>;
      case "approved":
        return <Tag color="success">Đang thực hiện</Tag>;
      case "completed":
        return <Tag color="blue">Đã hoàn thành</Tag>;
      default:
        return <Tag color="default">Đang cập nhật</Tag>;
    }
  };

  return (
    <Spin spinning={loading} tip="Đang tải thông tin...">
      <Card
        title="🎓 KHÔNG GIAN SINH VIÊN"
        variant="borderless"
        styles={{ header: { background: "#e6f7ff" } }} // Đã sửa từ headStyle cũ lỗi thời trong Ant Design mới
        style={{ borderRadius: "8px", overflow: "hidden" }}
      >
        <Row gutter={[16, 16]}>
          {dashboardData?.systemMessage && (
            <Col span={24}>
              <Alert
                message={`Thông tin: ${dashboardData.systemMessage}`}
                type="info"
                showIcon
              />
            </Col>
          )}

          <Col span={24} style={{ marginTop: "10px" }}>
            <Title level={5}>Thông tin khóa luận:</Title>
            <div
              style={{
                padding: "15px",
                background: "#fafafa",
                borderRadius: "4px",
              }}
            >
              <p>
                <Text strong>Đề tài:</Text>{" "}
                <Text>{dashboardData?.thesisTitle || "Chưa đăng ký"}</Text>
              </p>
              <p>
                <Text strong>Giảng viên:</Text>{" "}
                <Text>{dashboardData?.advisorName || "Chưa có"}</Text>
              </p>
              <p>
                <Text strong>Trạng thái:</Text>{" "}
                {renderStatusTag(dashboardData?.status)}
              </p>
            </div>
          </Col>

          {/* Nút điều hướng thông minh */}
          <Col span={12}>
            {dashboardData?.status === "approved" ? (
              <Button
                type="primary"
                icon={<RocketOutlined />}
                block
                size="large"
                style={{ background: "#52c41a", borderColor: "#52c41a" }}
                onClick={() => history.push("/student/progress")}
              >
                Quản lý tiến độ
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<BookOutlined />}
                block
                size="large"
                onClick={() => history.push("/student/registration")}
              >
                Đăng ký đề tài
              </Button>
            )}
          </Col>

          <Col span={12}>
            <Button
              icon={<MailOutlined />}
              block
              size="large"
              onClick={() => {
                window.location.href = `mailto:${dashboardData?.supportEmail || "support@ptit.edu.vn"}`;
              }}
            >
              Liên hệ hỗ trợ
            </Button>
          </Col>
        </Row>
      </Card>
    </Spin>
  );
};

export default StudentView;
