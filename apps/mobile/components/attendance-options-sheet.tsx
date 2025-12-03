import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useEffect, useRef } from "react";
import { Animated, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

interface AttendanceOptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AttendanceOptionsModal({ visible, onClose }: AttendanceOptionsModalProps) {
  const cardColor = useThemeColor({}, 'card');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleScanVisitor = () => {
    router.push('/(protected)/visitors/scan-visitor');
    onClose();
  };

  const handleRequestAccess = () => {
    router.push('/(protected)/visitors/request-access');
    onClose();
  };
  
  useEffect(() => {
    if (visible) {
      // Reset animations to initial state
      slideAnim.setValue(300);
      fadeAnim.setValue(0);

      // Animate both backdrop and slide together
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdropContainer,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContent,
            { backgroundColor: cardColor },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <SafeAreaView edges={['bottom']}>
            <ThemedView style={styles.container}>
              <ThemedText style={styles.title}>Visitantes</ThemedText>
              <ThemedText style={styles.description}>
                Registra la asistencia de visitantes mediante el escaneo de códigos QR.
              </ThemedText>
              <View style={styles.buttonContainer}>
                <Button onPress={handleScanVisitor}>Validar visitante</Button>
                {/* ! TODO: Add request access button when we have the feature */}
                {/* <Button onPress={handleRequestAccess} type="secondary">Solicitar acceso (visita)</Button> */}
              </View>
            </ThemedView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  container: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
});

