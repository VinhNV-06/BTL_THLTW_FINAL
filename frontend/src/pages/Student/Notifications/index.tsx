import React, { useEffect, useState } from "react";
import { Card, Typography, Badge, Button, Spin, message, Empty } from "antd";
import { CheckOutlined, BellOutlined } from "@ant-design/icons";
import {
  getMyNotifications,
  markNotificationAsRead,
} from "@/services/student/notification";
import type { NotificationItem } from "@/services/student/notification";
import moment from "moment";

const { Title, Text } = Typography;

const sortNewestFirst = (items: NotificationItem[]): NotificationItem[] =>
  [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

const StudentNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchNotifications = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await getMyNotifications();

      // Bộ phòng thủ 2 lớp: backend có thể trả về array trực tiếp
      // HOẶC object bọc { data: [...] } tuỳ phiên bản.
      let list: NotificationItem[] = [];
      if (Array.isArray(res)) {
        list = res as NotificationItem[];
      } else if (
        res &&
        typeof res === "object" &&
        "data" in res &&
        Array.isArray((res as { data: unknown }).data)
      ) {
        list = ((res as { data: NotificationItem[] }).data) || [];
      }

      setNotifications(sortNewestFirst(list));
    } catch (error: unknown) {
      console.error("Failed to fetch student notifications:", error);
      void message.error("Lỗi khi tải thông báo từ hệ thống");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number): Promise<void> => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        sortNewestFirst(
          prev.map((notif) =>
            notif.id === id ? { ...notif, is_read: true } : notif,
          ),
        ),
      );
      void message.success("Đã đánh dấu là đã đọc");
    } catch (error: unknown) {
      console.error(`Failed to mark notification ${id} as read:`, error);
      void message.error("Lỗi khi cập nhật trạng thái");
    }
  };

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "#f5f5f5" }}>
      <Card
        variant="borderless"
        style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
            gap: 12,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              background: "#e6f4ff",
              borderRadius: 8,
            }}
          >
            <BellOutlined style={{ fontSize: 20, color: "#1677ff" }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>
            Thông báo của bạn
          </Title>
        </div>

        <Spin spinning={loading}>
          {notifications.length === 0 && !loading ? (
            <Empty
              description="Bạn chưa có thông báo nào"
              style={{ margin: "40px 0" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {notifications.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    padding: "16px 4px",
                    borderBottom:
                      index < notifications.length - 1
                        ? "1px solid #f0f0f0"
                        : "none",
                    background: item.is_read ? "transparent" : "#f6ffed",
                  }}
                >
                  <div style={{ flexShrink: 0, width: 10 }}>
                    {!item.is_read ? (
                      <Badge status="processing" />
                    ) : (
                      <Badge status="default" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <Text
                        strong={!item.is_read}
                        style={{
                          fontSize: 15,
                          color: item.is_read ? "#8c8c8c" : "#262626",
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        {moment(item.created_at).format("DD/MM/YYYY, HH:mm")}
                      </Text>
                    </div>
                    {item.message && (
                      <Text
                        style={{
                          display: "block",
                          marginTop: 4,
                          color: item.is_read ? "#8c8c8c" : "#595959",
                        }}
                      >
                        {item.message}
                      </Text>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {!item.is_read ? (
                      <Button
                        type="link"
                        icon={<CheckOutlined />}
                        onClick={() => {
                          void handleMarkAsRead(item.id);
                        }}
                        style={{ padding: 0, whiteSpace: "nowrap" }}
                      >
                        Đánh dấu đã đọc
                      </Button>
                    ) : (
                      <Text
                        type="secondary"
                        style={{ fontSize: 13, whiteSpace: "nowrap" }}
                      >
                        <CheckOutlined style={{ marginRight: 4 }} />
                        Đã xem
                      </Text>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default StudentNotifications;
