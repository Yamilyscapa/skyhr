import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken, unregisterPushToken } from "./api";
import { DeviceType, NotificationState, PushRegistrationResult } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

function resolveDeviceType(): DeviceType {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "unknown";
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    permissionStatus: "undetermined",
    expoPushToken: null,
    lastNotificationId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAndroidChannel().catch((err) => console.error("notification channel error", err));

    Notifications.getPermissionsAsync()
      .then(({ status }) => setState((prev) => ({ ...prev, permissionStatus: status })))
      .catch((err) => console.error("getPermissionsAsync error", err));

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setState((prev) => ({
        ...prev,
        lastNotificationId: notification.request.identifier,
      }));
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      setState((prev) => ({
        ...prev,
        lastNotificationId: response.notification.request.identifier,
      }));
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<Notifications.PermissionStatus> => {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") {
      setState((prev) => ({ ...prev, permissionStatus: existing.status }));
      return existing.status;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    setState((prev) => ({ ...prev, permissionStatus: status }));
    return status;
  }, []);

  const getExpoPushToken = useCallback(async () => {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      Constants?.expoConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  }, []);

  const registerDevicePushToken = useCallback(async (): Promise<PushRegistrationResult> => {
    setIsLoading(true);
    try {
      const permission = await requestPermission();
      if (permission !== "granted") {
        return { token: null, error: "Notifications permission not granted" };
      }

      const token = await getExpoPushToken();
      if (!token) {
        return { token: null, error: "Unable to obtain Expo push token" };
      }

      if (registeredTokenRef.current !== token) {
        await registerPushToken(token, resolveDeviceType());
        registeredTokenRef.current = token;
      }

      setState((prev) => ({
        ...prev,
        expoPushToken: token,
        permissionStatus: "granted",
      }));

      return { token };
    } catch (error) {
      console.error("registerDevicePushToken error:", error);
      return { token: null, error: "Failed to register push token" };
    } finally {
      setIsLoading(false);
    }
  }, [getExpoPushToken, requestPermission]);

  const unregisterDevicePushToken = useCallback(async () => {
    const token = registeredTokenRef.current ?? state.expoPushToken;
    if (!token) return;

    try {
      await unregisterPushToken(token);
    } catch (error) {
      console.error("unregisterDevicePushToken error:", error);
    }
  }, [state.expoPushToken]);

  return {
    ...state,
    isLoading,
    registerDevicePushToken,
    unregisterDevicePushToken,
    refreshPermissions: requestPermission,
  };
}



