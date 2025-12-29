export type DeviceType = "ios" | "android" | "unknown";

export interface NotificationState {
  permissionStatus: "granted" | "denied" | "undetermined";
  expoPushToken: string | null;
  lastNotificationId: string | null;
}

export interface PushRegistrationResult {
  token: string | null;
  error?: string;
}



