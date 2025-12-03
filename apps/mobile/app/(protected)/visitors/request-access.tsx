import ThemedText from "@/components/themed-text";
import ThemedView from "@/components/ui/themed-view";
import { SafeAreaView } from "react-native-safe-area-context";


export default function RequestAccess() {
  return (
    <SafeAreaView>
      <ThemedView>
        <ThemedText>RequestAccess</ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}