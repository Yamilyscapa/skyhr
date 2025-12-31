import api from "@/api";
import { DeviceType } from "./types";

export async function registerPushToken(token: string, deviceType: DeviceType) {
  return api.post("push-tokens", {
    token,
    device_type: deviceType,
  });
}

export async function unregisterPushToken(token: string) {
  return api.delete("push-tokens", { token });
}





