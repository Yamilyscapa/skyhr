import api, { ApiError, NetworkError } from "@/api";
import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import { TextSize } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PermissionRequestModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PermissionRequestModal({
    visible,
    onClose,
    onSuccess,
}: PermissionRequestModalProps) {
    const cardColor = useThemeColor({}, 'card');
    const textColor = useThemeColor({}, 'text');
    const neutralColor = useThemeColor({}, 'neutral');
    const primaryColor = useThemeColor({}, 'primary');
    const colorScheme = useColorScheme();

    const slideAnim = useRef(new Animated.Value(300)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [startingDate, setStartingDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [startDay, setStartDay] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endDay, setEndDay] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    const [message, setMessage] = useState('');
    const [document, setDocument] = useState<{ uri: string; name: string; type: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{
        startingDate?: string;
        endDate?: string;
        message?: string;
    }>({});

    useEffect(() => {
        const day = parseInt(startDay);
        const month = parseInt(startMonth);
        const year = parseInt(startYear);

        if (startDay && startMonth && startYear && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                setStartingDate(date);
                if (errors.startingDate) {
                    setErrors(prev => ({ ...prev, startingDate: undefined }));
                }
            } else {
                setStartingDate(null);
            }
        } else {
            setStartingDate(null);
        }
    }, [startDay, startMonth, startYear]);

    useEffect(() => {
        const day = parseInt(endDay);
        const month = parseInt(endMonth);
        const year = parseInt(endYear);

        if (endDay && endMonth && endYear && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                setEndDate(date);
                if (errors.endDate) {
                    setErrors(prev => ({ ...prev, endDate: undefined }));
                }
            } else {
                setEndDate(null);
            }
        } else {
            setEndDate(null);
        }
    }, [endDay, endMonth, endYear]);

    useEffect(() => {
        if (visible) {
            slideAnim.setValue(300);
            fadeAnim.setValue(0);
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
            // Reset form when modal closes
            setTimeout(() => {
                setStartingDate(null);
                setEndDate(null);
                setStartDay('');
                setStartMonth('');
                setStartYear('');
                setEndDay('');
                setEndMonth('');
                setEndYear('');
                setMessage('');
                setDocument(null);
                setErrors({});
            }, 300);
        }
    }, [visible, slideAnim, fadeAnim]);

    const formatDateToDisplay = (date: Date | null): string => {
        if (!date) return '';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateToISO = (date: Date | null): string => {
        if (!date) return '';
        const dateCopy = new Date(date);
        dateCopy.setHours(0, 0, 0, 0);
        return dateCopy.toISOString();
    };

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        if (!startingDate) {
            newErrors.startingDate = 'La fecha de inicio es requerida';
        }

        if (!endDate) {
            newErrors.endDate = 'La fecha de fin es requerida';
        } else if (startingDate && endDate) {
            // Compare dates (reset time to compare only dates)
            const start = new Date(startingDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);
            
            if (end <= start) {
                newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
            }
        }

        if (!message.trim()) {
            newErrors.message = 'El mensaje es requerido';
        } else if (message.trim().length < 10) {
            newErrors.message = 'El mensaje debe tener al menos 10 caracteres';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const startingDateISO = formatDateToISO(startingDate);
            const endDateISO = formatDateToISO(endDate);

            if (!startingDateISO || !endDateISO) {
                Alert.alert('Error', 'Fechas inválidas. Por favor verifica las fechas seleccionadas.');
                setIsSubmitting(false);
                return;
            }

            await api.createPermission(
                {
                    starting_date: startingDateISO,
                    end_date: endDateISO,
                    message: message.trim(),
                },
                document || undefined
            );

            Alert.alert('Éxito', 'Tu solicitud de permiso ha sido creada exitosamente');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating permission:', error);
            
            let errorMessage = 'Error al crear la solicitud. Por favor intenta de nuevo.';
            if (error instanceof NetworkError) {
                errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
            } else if (error instanceof ApiError) {
                errorMessage = error.message || errorMessage;
            } else if (error?.message) {
                errorMessage = error.message;
            }
            
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDocumentSelect = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) {
                return;
            }

            const file = result.assets[0];
            
            // Validate file size (10MB max)
            const maxSize = 10 * 1024 * 1024; // 10MB in bytes
            if (file.size && file.size > maxSize) {
                Alert.alert(
                    'Error',
                    'El archivo es demasiado grande. El tamaño máximo es 10MB.'
                );
                return;
            }

            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            if (file.mimeType && !allowedTypes.includes(file.mimeType)) {
                Alert.alert(
                    'Error',
                    'Tipo de archivo no permitido. Solo se permiten PDF, JPEG y PNG.'
                );
                return;
            }

            // Get file extension for name
            const uriParts = file.uri.split('.');
            const fileExtension = uriParts[uriParts.length - 1];
            const fileName = file.name || `documento.${fileExtension}`;

            setDocument({
                uri: file.uri,
                name: fileName,
                type: file.mimeType || `application/${fileExtension}`,
            });
        } catch (error: any) {
            console.error('Error selecting document:', error);
            if (error.code === 'E_DOCUMENT_PICKER_CANCELED') {
                // User canceled, do nothing
                return;
            }
            Alert.alert(
                'Error',
                'No se pudo seleccionar el documento. Por favor intenta de nuevo.'
            );
        }
    };

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
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.keyboardView}
                        >
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                <ThemedView style={styles.container}>
                                    <View style={styles.header}>
                                        <ThemedText style={styles.title}>Nueva solicitud de permiso</ThemedText>
                                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                            <Ionicons name="close" size={24} color={textColor} />
                                        </TouchableOpacity>
                                    </View>

                                    <ThemedText style={styles.description}>
                                        Completa el formulario para solicitar un permiso o vacación
                                    </ThemedText>

                                    <View style={styles.form}>
                                        <View style={styles.inputGroup}>
                                            <ThemedText style={[styles.label, { color: textColor }]}>
                                                Fecha de inicio *
                                            </ThemedText>
                                            <View style={styles.dateRow}>
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.datePartInput,
                                                        {
                                                            borderColor: errors.startingDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="DD"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    value={startDay}
                                                    onChangeText={setStartDay}
                                                    editable={!isSubmitting}
                                                />
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.datePartInput,
                                                        {
                                                            borderColor: errors.startingDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="MM"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    value={startMonth}
                                                    onChangeText={setStartMonth}
                                                    editable={!isSubmitting}
                                                />
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.dateYearInput,
                                                        {
                                                            borderColor: errors.startingDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="YYYY"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={4}
                                                    value={startYear}
                                                    onChangeText={setStartYear}
                                                    editable={!isSubmitting}
                                                />
                                            </View>
                                            {errors.startingDate && (
                                                <ThemedText style={styles.errorText}>
                                                    {errors.startingDate}
                                                </ThemedText>
                                            )}
                                        </View>

                                        <View style={styles.inputGroup}>
                                            <ThemedText style={[styles.label, { color: textColor }]}>
                                                Fecha de fin *
                                            </ThemedText>
                                            <View style={styles.dateRow}>
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.datePartInput,
                                                        {
                                                            borderColor: errors.endDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="DD"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    value={endDay}
                                                    onChangeText={setEndDay}
                                                    editable={!isSubmitting}
                                                />
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.datePartInput,
                                                        {
                                                            borderColor: errors.endDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="MM"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    value={endMonth}
                                                    onChangeText={setEndMonth}
                                                    editable={!isSubmitting}
                                                />
                                                <TextInput
                                                    style={[
                                                        styles.input,
                                                        styles.dateYearInput,
                                                        {
                                                            borderColor: errors.endDate ? '#ED474A' : neutralColor,
                                                            backgroundColor: cardColor,
                                                            color: textColor,
                                                        },
                                                    ]}
                                                    placeholder="YYYY"
                                                    placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                    keyboardType="number-pad"
                                                    maxLength={4}
                                                    value={endYear}
                                                    onChangeText={setEndYear}
                                                    editable={!isSubmitting}
                                                />
                                            </View>
                                            {errors.endDate && (
                                                <ThemedText style={styles.errorText}>
                                                    {errors.endDate}
                                                </ThemedText>
                                            )}
                                        </View>

                                        <View style={styles.inputGroup}>
                                            <ThemedText style={[styles.label, { color: textColor }]}>
                                                Motivo / Mensaje *
                                            </ThemedText>
                                            <TextInput
                                                style={[
                                                    styles.textArea,
                                                    {
                                                        borderColor: errors.message ? '#ED474A' : neutralColor,
                                                        backgroundColor: cardColor,
                                                        color: textColor,
                                                    },
                                                ]}
                                                placeholder="Describe el motivo de tu solicitud..."
                                                placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                                                value={message}
                                                onChangeText={(text) => {
                                                    setMessage(text);
                                                    if (errors.message) {
                                                        setErrors({ ...errors, message: undefined });
                                                    }
                                                }}
                                                multiline
                                                numberOfLines={4}
                                                textAlignVertical="top"
                                                editable={!isSubmitting}
                                            />
                                            {errors.message && (
                                                <ThemedText style={styles.errorText}>
                                                    {errors.message}
                                                </ThemedText>
                                            )}
                                        </View>

                                        <View style={styles.inputGroup}>
                                            <ThemedText style={[styles.label, { color: textColor }]}>
                                                Documento (opcional)
                                            </ThemedText>
                                            <TouchableOpacity
                                                style={[
                                                    styles.documentButton,
                                                    { borderColor: neutralColor, backgroundColor: cardColor },
                                                ]}
                                                onPress={handleDocumentSelect}
                                                disabled={isSubmitting}
                                            >
                                                <Ionicons name="document-attach-outline" size={20} color={textColor} />
                                                <ThemedText style={[styles.documentButtonText, { color: textColor }]}>
                                                    {document ? document.name : 'Seleccionar documento'}
                                                </ThemedText>
                                            </TouchableOpacity>
                                            {document && (
                                                <TouchableOpacity
                                                    onPress={() => setDocument(null)}
                                                    style={styles.removeDocument}
                                                >
                                                    <Ionicons name="close-circle" size={16} color="#ED474A" />
                                                    <ThemedText style={styles.removeDocumentText}>
                                                        Eliminar
                                                    </ThemedText>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View style={styles.buttonContainer}>
                                            <Button
                                                onPress={handleSubmit}
                                                disabled={isSubmitting}
                                                style={styles.submitButton}
                                            >
                                                {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
                                            </Button>
                                            <Button
                                                type="secondary"
                                                onPress={onClose}
                                                disabled={isSubmitting}
                                                style={styles.cancelButton}
                                            >
                                                Cancelar
                                            </Button>
                                        </View>
                                    </View>
                                </ThemedView>
                            </ScrollView>
                        </KeyboardAvoidingView>
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
        maxHeight: '90%',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        paddingBottom: 24,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: TextSize.h2,
        fontWeight: 'bold',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    description: {
        fontSize: TextSize.p,
        opacity: 0.7,
        marginBottom: 24,
    },
    form: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: TextSize.p,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 8,
    },
    datePartInput: {
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    dateYearInput: {
        flex: 1.5,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        minHeight: 100,
    },
    errorText: {
        fontSize: TextSize.small,
        color: '#ED474A',
        marginTop: 4,
    },
    documentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    documentButtonText: {
        fontSize: 16,
    },
    removeDocument: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    removeDocumentText: {
        fontSize: TextSize.small,
        color: '#ED474A',
    },
    buttonContainer: {
        gap: 12,
        marginTop: 8,
    },
    submitButton: {
        width: '100%',
    },
    cancelButton: {
        width: '100%',
    },
});

