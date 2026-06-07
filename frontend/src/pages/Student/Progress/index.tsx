import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Space,
  Input,
  Button,
  Progress as AntProgress,
  Divider,
  Modal,
  Slider,
  Select,
  Form,
  Checkbox,
  List,
  Spin,
  Timeline,
  Upload,
  Popconfirm,
  Tooltip,
  message,
} from "antd";
import {
  CalendarOutlined,
  SendOutlined,
  RocketOutlined,
  CheckOutlined,
  SyncOutlined,
  EditOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import type { RadioChangeEvent } from "antd";
import { request, useModel, history } from "umi";
import moment from "moment";

import {
  getProgressByThesis,
  updateStudentMilestoneStatus,
} from "../../../services/progress";
import {
  Milestone,
  MilestoneStatus,
} from "../../../types/LecturerTypes/MilestonesTypes";
import StudentHeader from "../components/StudentHeader";
import { ProgressResponse } from "../../../types/StudentTypes/ProgressTypes";
import {
  getCommentsBySubmission,
  postComment,
} from "../../../services/comment";
import type { MessageInstance } from "antd/es/message/interface";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// --- Định nghĩa các Interface dữ liệu rõ ràng ---
interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

interface BackendCommentItem {
  id: number;
  sender_name: string;
  content: string;
  created_at: string;
}

interface CommentModalProps {
  submissionId: number | null;
  open: boolean;
  onClose: () => void;
  messageApi: MessageInstance;
}

interface ProgressReportSectionProps {
  thesisId: number;
  studentId: number;
  tasks: Milestone[];
  messageApi: MessageInstance;
}

const statusConfig: Record<
  MilestoneStatus,
  { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
  completed: {
    color: "#52c41a",
    bg: "#f6ffed",
    icon: <CheckOutlined />,
    label: "Hoàn thành",
  },
  pending: {
    color: "#1677ff",
    bg: "#e6f4ff",
    icon: <SyncOutlined spin />,
    label: "Đang thực hiện",
  },
  overdue: {
    color: "#ff4d4f",
    bg: "#fff2f0",
    icon: <ClockCircleOutlined />,
    label: "Quá hạn",
  },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: "#ff4d4f", label: "Cao" },
  medium: { color: "#fa8c16", label: "Trung bình" },
  low: { color: "#52c41a", label: "Thấp" },
};

const getDerivedProgress = (status: MilestoneStatus): number =>
  status === "completed" ? 100 : 0;

const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.UMI_APP_API_URL) ||
  "http://localhost:5000";

// ==========================================
// 1. Component TaskCard
// ==========================================
const TaskCard: React.FC<{
  task: Milestone;
  onUpdate: (id: number, newStatus: MilestoneStatus) => void;
  updatingId: number | null;
}> = ({ task, onUpdate, updatingId }) => {
  const cfg = statusConfig[task.status] || statusConfig.pending;
  const pri = priorityConfig.medium;
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editProgress, setEditProgress] = useState<number>(
    getDerivedProgress(task.status),
  );

  const handleOpenModal = (): void => {
    setEditProgress(getDerivedProgress(task.status));
    setIsModalOpen(true);
  };
  const handleConfirmUpdate = (): void => {
    onUpdate(task.id, editProgress === 100 ? "completed" : "pending");
    setIsModalOpen(false);
  };

  const currentPercent = getDerivedProgress(task.status);
  const isUpdating = updatingId === task.id;

  return (
    <>
      <div
        className="task-card-hover"
        style={{
          background: cfg.bg,
          border:
            task.status === "pending"
              ? "1.5px solid #1677ff33"
              : "1.5px solid #f0f0f0",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 10,
          transition: "all 0.25s ease",
          position: "relative",
          overflow: "hidden",
          opacity: isUpdating ? 0.6 : 1,
        }}
      >
        {(task.status === "pending" || task.status === "overdue") && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${currentPercent}%`,
              height: 3,
              background: "linear-gradient(90deg, #1677ff, #69b1ff)",
            }}
          />
        )}
        {task.status === "completed" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: 3,
              background: "linear-gradient(90deg, #52c41a, #95de64)",
            }}
          />
        )}

        <Row justify="space-between" align="top" wrap={false}>
          <Col flex="auto">
            <Space size={6}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <Text strong>{task.title}</Text>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {task.description}
              </Text>
            </div>
            {task.status === "pending" && (
              <div style={{ marginTop: 8 }}>
                <AntProgress
                  percent={currentPercent}
                  size="small"
                  showInfo={false}
                  strokeColor={{ from: "#1677ff", to: "#69b1ff" }}
                />
                <Text style={{ fontSize: 11, color: "#1677ff" }}>
                  Đang tiến hành theo kế hoạch
                </Text>
              </div>
            )}
          </Col>
          <Col style={{ marginLeft: 12 }}>
            <Space direction="vertical" size={6} align="end">
              <Space>
                <Tag
                  style={{
                    background: `${pri.color}18`,
                    color: pri.color,
                    border: `1px solid ${pri.color}40`,
                    borderRadius: 6,
                    margin: 0,
                  }}
                >
                  {pri.label}
                </Tag>
                <Tooltip title="Cập nhật trạng thái">
                  <Button
                    type="text"
                    size="small"
                    disabled={isUpdating}
                    icon={
                      isUpdating ? (
                        <SyncOutlined spin style={{ color: "#1677ff" }} />
                      ) : (
                        <EditOutlined style={{ color: "#1677ff" }} />
                      )
                    }
                    onClick={handleOpenModal}
                    style={{ background: "#e6f4ff", borderRadius: 6 }}
                  />
                </Tooltip>
              </Space>
              <Space size={4}>
                <CalendarOutlined style={{ fontSize: 11, color: "#8c8c8c" }} />
                <Text style={{ fontSize: 11, color: "#8c8c8c" }}>
                  {task.deadline
                    ? moment(task.deadline).format("DD/MM/YYYY")
                    : "Chưa có hạn"}
                </Text>
              </Space>
            </Space>
          </Col>
        </Row>
      </div>

      <Modal
        open={isModalOpen}
        onOk={handleConfirmUpdate}
        onCancel={() => setIsModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={400}
        title={
          <Space>
            <SyncOutlined style={{ color: "#1677ff" }} />
            <Text strong>Cập nhật trạng thái công việc</Text>
          </Space>
        }
      >
        <div style={{ paddingTop: 20 }}>
          <Text strong>{task.title}</Text>
          <Row gutter={16} align="middle" style={{ marginTop: 20 }}>
            <Col span={18}>
              <Slider
                min={0}
                max={100}
                step={100}
                value={editProgress}
                onChange={(val: number) => setEditProgress(val)}
              />
            </Col>
            <Col span={6}>
              <div
                style={{
                  background: "#f0f5ff",
                  border: "1px solid #1677ff",
                  borderRadius: 8,
                  textAlign: "center",
                  padding: "4px 0",
                }}
              >
                <Text strong style={{ color: "#1677ff" }}>
                  {editProgress === 100 ? "Xong" : "Chưa"}
                </Text>
              </div>
            </Col>
          </Row>
        </div>
      </Modal>
    </>
  );
};

// ==========================================
// 2. Component ProgressSection
// ==========================================
const ProgressSection: React.FC<{
  tasks: Milestone[];
  onUpdateTask: (id: number, newStatus: MilestoneStatus) => void;
  updatingId: number | null;
}> = ({ tasks, onUpdateTask, updatingId }) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState<string>("");

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = tasks.filter((t) => t.status === "pending").length;
  const overdueCount = tasks.filter((t) => t.status === "overdue").length;

  const handleAddTodo = (): void => {
    if (!todoInput.trim()) return;
    setTodos([
      ...todos,
      { id: Date.now(), text: todoInput.trim(), done: false },
    ]);
    setTodoInput("");
  };

  const toggleTodo = (id: number): void =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #722ed1, #9254de)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RocketOutlined style={{ color: "#fff", fontSize: 18 }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Mục tiêu & Kế hoạch
          </Title>
          <Text type="secondary">Do giảng viên phân công</Text>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          Danh sách công việc
        </Title>
        <Space wrap>
          <Tag color="success">{completedCount} xong</Tag>
          <Tag color="processing">{inProgressCount} đang làm</Tag>
          {overdueCount > 0 && <Tag color="error">{overdueCount} quá hạn</Tag>}
        </Space>
      </div>

      {tasks.length === 0 ? (
        <div
          style={{ textAlign: "center", padding: "30px 0", color: "#bfbfbf" }}
        >
          Chưa có công việc nào được giao.
        </div>
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={onUpdateTask}
            updatingId={updatingId}
          />
        ))
      )}

      <Divider />
      <Title level={5} style={{ fontSize: 14 }}>
        Ghi chú nhanh (Cá nhân)
      </Title>
      <List
        size="small"
        dataSource={todos}
        locale={{ emptyText: "Chưa có ghi chú nào được thêm." }}
        renderItem={(item: TodoItem) => (
          <List.Item style={{ borderBottom: "none", padding: "6px 0" }}>
            <Checkbox checked={item.done} onChange={() => toggleTodo(item.id)}>
              <Text delete={item.done}>{item.text}</Text>
            </Checkbox>
          </List.Item>
        )}
      />
      <Input
        value={todoInput}
        onChange={(e) => setTodoInput(e.target.value)}
        onPressEnter={handleAddTodo}
        placeholder="Ví dụ: Hẹn mentor review API"
        prefix={<PlusOutlined />}
        suffix={
          <SendOutlined
            onClick={handleAddTodo}
            style={{
              color: todoInput.trim() ? "#1677ff" : "#bfbfbf",
              cursor: "pointer",
            }}
          />
        }
        style={{ marginTop: 8, borderRadius: 8 }}
      />
    </Card>
  );
};

// ==========================================
// 3. Component CommentModal
// ==========================================
const CommentModal: React.FC<CommentModalProps> = ({
  submissionId,
  open,
  onClose,
  messageApi,
}) => {
  const [comments, setComments] = useState<BackendCommentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [content, setContent] = useState<string>("");

  const fetchComments = async (): Promise<void> => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const res = await getCommentsBySubmission(submissionId);
      setComments(Array.isArray(res) ? (res as BackendCommentItem[]) : []);
    } catch {
      void messageApi.error("Không thể tải comment!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && submissionId) {
      void fetchComments();
    }
  }, [open, submissionId]);

  const handleSend = async (): Promise<void> => {
    if (!content.trim() || !submissionId) return;
    setSubmitting(true);
    try {
      await postComment(submissionId, content);
      setContent("");
      void messageApi.success("Đã gửi comment!");
      void fetchComments();
    } catch {
      void messageApi.error("Gửi comment thất bại!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Trao đổi về bài nộp"
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Spin spinning={loading}>
        <div
          style={{ maxHeight: "400px", overflowY: "auto", marginBottom: 16 }}
        >
          <List
            dataSource={comments}
            locale={{ emptyText: "Chưa có bình luận nào." }}
            renderItem={(item: BackendCommentItem) => (
              <List.Item style={{ border: "none", padding: "8px 0" }}>
                <List.Item.Meta
                  title={
                    <Text strong style={{ fontSize: 12 }}>
                      {item.sender_name}
                    </Text>
                  }
                  description={
                    <div
                      style={{
                        background: "#f5f5f5",
                        padding: "8px",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#262626",
                      }}
                    >
                      {item.content}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập nội dung trao đổi..."
            onPressEnter={() => {
              void handleSend();
            }}
            disabled={submitting}
          />
          <Button
            type="primary"
            onClick={() => {
              void handleSend();
            }}
            loading={submitting}
            icon={<SendOutlined />}
          >
            Gửi
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

// ==========================================
// 4. Component ProgressReportSection
// ==========================================
interface FormFields {
  milestone_id: number;
  fileName: string;
  file_url?: string;
  description?: string;
}

const ProgressReportSection: React.FC<ProgressReportSectionProps> = ({
  thesisId,
  studentId,
  tasks,
  messageApi,
}) => {
  const [form] = Form.useForm<FormFields>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [progressHistory, setProgressHistory] = useState<ProgressResponse[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const [isCommentModalOpen, setIsCommentModalOpen] = useState<boolean>(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(
    null,
  );

  const openCommentModal = (id: number): void => {
    setActiveSubmissionId(id);
    setIsCommentModalOpen(true);
  };

  const fetchHistory = async (): Promise<void> => {
    if (!thesisId) return;
    try {
      setLoadingHistory(true);
      const res = await getProgressByThesis(thesisId);
      if (Array.isArray(res)) {
        setProgressHistory(res as ProgressResponse[]);
      } else if (res?.data && Array.isArray(res.data)) {
        setProgressHistory(res.data as ProgressResponse[]);
      } else {
        setProgressHistory([]);
      }
    } catch {
      void messageApi.error("Lỗi khi tải lịch sử báo cáo!");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, [thesisId]);

  const handleSubmitProgress = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const fileToUpload = fileList[0]?.originFileObj || fileList[0];
      const linkUrl = values.file_url;

      if (!fileToUpload && !linkUrl) {
        void messageApi.error(
          "Vui lòng đính kèm file báo cáo HOẶC dán link tài liệu!",
        );
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        void messageApi.error(
          "Phiên đăng nhập hết hạn! Vui lòng tải lại trang.",
        );
        return;
      }

      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("milestone_id", values.milestone_id.toString());
      formData.append("thesis_id", thesisId.toString());
      formData.append("student_id", studentId.toString());
      formData.append("file_name", values.fileName);
      formData.append("description", values.description || "");

      if (fileToUpload) formData.append("file", fileToUpload as Blob);
      if (linkUrl) formData.append("file_url", linkUrl);

      const response = await fetch(`${API_BASE}/api/progress`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Lỗi nộp báo cáo!");

      void messageApi.success("Đã nộp báo cáo tiến độ thành công!");
      form.resetFields();
      setFileList([]);
      void fetchHistory();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra, vui lòng thử lại!";
      void messageApi.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmission = async (
    submissionId: number,
  ): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      await request(`progress/submissions/${submissionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      void messageApi.success("Đã thu hồi báo cáo thành công!");
      void fetchHistory();
    } catch {
      void messageApi.error("Lỗi khi thu hồi báo cáo!");
    }
  };

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #1677ff, #36cfc9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FileTextOutlined style={{ color: "#fff", fontSize: 18 }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Báo cáo Tiến độ
          </Title>
          <Text type="secondary">
            Nộp file báo cáo và nhận xét từ giảng viên
          </Text>
        </div>
      </div>

      <Row gutter={[32, 24]}>
        <Col xs={24} lg={12}>
          <Title level={5}>Nộp báo cáo mới</Title>
          <Form form={form} layout="vertical">
            <Form.Item
              name="milestone_id"
              label="Đợt báo cáo (Cột mốc)"
              rules={[
                { required: true, message: "Vui lòng chọn đợt báo cáo!" },
              ]}
            >
              <Select
                placeholder="-- Chọn cột mốc cần nộp --"
                disabled={isSubmitting}
              >
                {tasks.map((task) => (
                  <Option key={task.id} value={task.id}>
                    {task.title}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="fileName"
              label="Tên file / Tiêu đề"
              rules={[
                { required: true, message: "Vui lòng nhập tên file/tiêu đề!" },
              ]}
            >
              <Input
                placeholder="Ví dụ: Báo cáo Tuần 3 - Thiết kế API"
                disabled={isSubmitting}
              />
            </Form.Item>

            <Form.Item label="Đính kèm tài liệu">
              <Upload
                maxCount={1}
                beforeUpload={(file) => {
                  setFileList([file]);
                  return false;
                }}
                onRemove={() => setFileList([])}
                fileList={fileList}
              >
                <Button icon={<UploadOutlined />} disabled={isSubmitting}>
                  Chọn file (PDF, Word, ZIP)
                </Button>
              </Upload>
            </Form.Item>

            <Form.Item
              name="file_url"
              label="Hoặc nộp bằng Link (Google Drive, Github, Notion...)"
            >
              <Input placeholder="https://..." disabled={isSubmitting} />
            </Form.Item>

            <Form.Item name="description" label="Nội dung công việc đã làm">
              <TextArea
                rows={4}
                placeholder="Tóm tắt ngắn gọn các việc đã hoàn thành..."
                disabled={isSubmitting}
              />
            </Form.Item>

            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={isSubmitting}
              onClick={() => {
                void handleSubmitProgress();
              }}
              block
              style={{ borderRadius: 8, height: 40 }}
            >
              Gửi Báo Cáo
            </Button>
          </Form>
        </Col>

        <Col xs={24} lg={12}>
          <Title level={5}>Lịch sử nộp ({progressHistory.length})</Title>
          <Spin spinning={loadingHistory}>
            {progressHistory.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#bfbfbf",
                }}
              >
                Chưa có báo cáo nào được nộp.
              </div>
            ) : (
              <Timeline
                style={{ marginTop: 16 }}
                items={progressHistory.map((item) => {
                  let color = "blue";
                  let statusText = "Đang chờ duyệt";
                  if (item.status === "approved") {
                    color = "green";
                    statusText = "Đã duyệt";
                  }
                  if (item.status === "rejected") {
                    color = "red";
                    statusText = "Cần chỉnh sửa";
                  }

                  return {
                    key: item.id,
                    color,
                    children: (
                      <>
                        <div style={{ marginBottom: 4 }}>
                          <Text strong>{item.file_name}</Text>
                          <Tag color={color} style={{ marginLeft: 8 }}>
                            {statusText}
                          </Tag>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#8c8c8c",
                            marginBottom: 4,
                          }}
                        >
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {moment(item.created_at).format("DD/MM/YYYY HH:mm")}
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {item.description}
                          </Text>
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <a
                            href={
                              item.file_url?.startsWith("http")
                                ? item.file_url
                                : `${API_BASE}${item.file_url}`
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="small" icon={<EyeOutlined />}>
                              Xem báo cáo
                            </Button>
                          </a>

                          <Button
                            size="small"
                            icon={<CommentOutlined />}
                            onClick={() =>
                              openCommentModal(item.submission_id || item.id)
                            }
                          >
                            Trao đổi
                          </Button>

                          {item.status === "approved" && (
                            <Button
                              type="primary"
                              size="small"
                              danger
                              icon={<RocketOutlined />}
                              onClick={() =>
                                history.push(
                                  `/student/submission/${thesisId}/${item.milestone_id}`,
                                )
                              }
                            >
                              Nộp sản phẩm chính thức
                            </Button>
                          )}
                        </div>

                        {item.status !== "approved" &&
                          item.status !== "rejected" && (
                            <div style={{ marginTop: 8 }}>
                              <Popconfirm
                                title="Thu hồi báo cáo"
                                description="Bạn có chắc chắn muốn thu hồi báo cáo này không?"
                                onConfirm={() =>
                                  void handleDeleteSubmission(
                                    item.submission_id || item.id,
                                  )
                                }
                                okText="Thu hồi"
                                cancelText="Hủy"
                              >
                                <Button
                                  danger
                                  size="small"
                                  type="text"
                                  icon={<DeleteOutlined />}
                                >
                                  Thu hồi
                                </Button>
                              </Popconfirm>
                            </div>
                          )}

                        {item.feedback && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "8px 12px",
                              background: "#fafafa",
                              borderLeft: "3px solid #d9d9d9",
                            }}
                          >
                            <Text strong style={{ fontSize: 13 }}>
                              GV Nhận xét:
                            </Text>{" "}
                            <br />
                            <Text style={{ fontSize: 13 }}>
                              {item.feedback}
                            </Text>
                          </div>
                        )}
                      </>
                    ),
                  };
                })}
              />
            )}
          </Spin>
        </Col>
      </Row>

      <CommentModal
        submissionId={activeSubmissionId}
        open={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        messageApi={messageApi}
      />
    </Card>
  );
};

// ==========================================
// 5. Component gốc Progress
// ==========================================
interface DashboardApiResponse {
  status?: string;
  thesisId?: number;
  data?: {
    status?: string;
    thesisId?: number;
  };
}

interface MilestonesApiResponse {
  data?: Milestone[];
}

const Progress: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<Milestone[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [realThesisId, setRealThesisId] = useState<number | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);

  const { initialState } = useModel("@@initialState");
  const currentUser = initialState?.currentUser;
  const CURRENT_STUDENT_ID = currentUser?.id;

  useEffect(() => {
    const fetchInitData = async (): Promise<void> => {
      if (!CURRENT_STUDENT_ID) {
        setLoadingInitial(false);
        return;
      }

      try {
        setLoadingInitial(true);
        const token = localStorage.getItem("token");

        const dashRes = (await request("student/dashboard", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })) as DashboardApiResponse;

        const actualStatus =
          dashRes?.status || dashRes?.data?.status || "not_registered";
        const fetchedThesisId = dashRes?.thesisId || dashRes?.data?.thesisId;

        if (actualStatus === "approved" && fetchedThesisId) {
          setIsApproved(true);
          setRealThesisId(fetchedThesisId);

          const milestonesRes = (await request(
            `progress/milestones/${fetchedThesisId}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            },
          )) as Milestone[] | MilestonesApiResponse;

          if (Array.isArray(milestonesRes)) {
            setTasks(milestonesRes);
          } else if (
            (milestonesRes as MilestonesApiResponse)?.data &&
            Array.isArray((milestonesRes as MilestonesApiResponse).data)
          ) {
            setTasks(
              (milestonesRes as MilestonesApiResponse).data as Milestone[],
            );
          }
        } else {
          setIsApproved(false);
        }
      } catch {
        void messageApi.error("Lỗi khi tải dữ liệu. Vui lòng thử lại.");
      } finally {
        setLoadingInitial(false);
      }
    };

    void fetchInitData();
  }, [CURRENT_STUDENT_ID]);

  if (
    !loadingInitial &&
    (!CURRENT_STUDENT_ID || !isApproved || !realThesisId)
  ) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f2f5", padding: 24 }}>
        <StudentHeader />
        <Card
          style={{
            marginTop: 24,
            textAlign: "center",
            borderRadius: 16,
            padding: "40px 20px",
          }}
        >
          <Title level={3} style={{ color: "#ff4d4f" }}>
            Chưa thể vào Không gian Tiến độ!
          </Title>
          <Text style={{ fontSize: 16 }}>
            Đề tài của bạn chưa được duyệt hoặc bạn chưa đăng ký.
          </Text>
          <br />
          <Button
            type="primary"
            size="large"
            /* 🔥 ĐÃ SỬA: Sửa lại đường dẫn tương đối đồng bộ thay vì /thesis lỗi trang */
            onClick={() => history.push("/student/registration")}
            style={{ marginTop: 24, borderRadius: 8 }}
          >
            Quay lại mục Đăng ký
          </Button>
        </Card>
      </div>
    );
  }

  const handleUpdateTask = async (
    taskId: number,
    newStatus: MilestoneStatus,
  ): Promise<void> => {
    try {
      setUpdatingId(taskId);
      await updateStudentMilestoneStatus(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
      void messageApi.success("Đã cập nhật trạng thái!");
    } catch {
      void messageApi.error("Lỗi cập nhật!");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Spin spinning={loadingInitial} tip="Đang kiểm tra thông tin...">
      {contextHolder}
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #f8faff 0%, #eef4ff 50%, #f0f9ff 100%)",
          padding: 24,
          fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
          .task-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.10); }
        `}</style>

        <StudentHeader />

        {!loadingInitial && realThesisId && (
          <div style={{ marginTop: 24 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} xl={10}>
                <ProgressSection
                  tasks={tasks}
                  onUpdateTask={handleUpdateTask}
                  updatingId={updatingId}
                />
              </Col>
              <Col xs={24} xl={14}>
                <ProgressReportSection
                  thesisId={realThesisId}
                  studentId={CURRENT_STUDENT_ID as number}
                  tasks={tasks}
                  messageApi={messageApi}
                />
              </Col>
            </Row>
          </div>
        )}
      </div>
    </Spin>
  );
};

export default Progress;
