import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, Mask, Rect } from "react-native-svg";

interface FaceScannerOverlayProps {
    width: number;
    height: number;
    scannerWidth: number;
    scannerHeight: number;
    scannerTop: number;
    scannerLeft: number;
}

export default function FaceScannerOverlay({
    width,
    height,
    scannerWidth,
    scannerHeight,
    scannerTop,
    scannerLeft,
}: FaceScannerOverlayProps) {
    const centerX = scannerLeft + scannerWidth / 2;
    const centerY = scannerTop + scannerHeight / 2;
    const radiusX = scannerWidth / 2;
    const radiusY = scannerHeight / 2;

    return (
        <>
            <Svg height={height} width={width} style={styles.svgOverlay}>
                <Defs>
                    <Mask id="faceMask" x="0" y="0" height="100%" width="100%">
                        <Rect height="100%" width="100%" fill="#fff" />
                        <Ellipse
                            cx={centerX}
                            cy={centerY}
                            rx={radiusX}
                            ry={radiusY}
                            fill="#000"
                        />
                    </Mask>
                </Defs>
                <Rect
                    height="100%"
                    width="100%"
                    fill="rgba(0, 0, 0, 0.6)"
                    mask="url(#faceMask)"
                />
                
                {/* Contorno del óvalo */}
                <Ellipse
                    cx={centerX}
                    cy={centerY}
                    rx={radiusX}
                    ry={radiusY}
                    stroke="white"
                    strokeWidth="3"
                    fill="transparent"
                    opacity={0.8}
                />
            </Svg>

            {/* Texto instructivo inferior */}
            <View style={[styles.instructionContainer, { top: scannerTop + scannerHeight + 40 }]}>
                <Text style={styles.instructionHint}>
                    Mantén tu rostro bien iluminado y mirando al frente
                </Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    svgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    instructionContainer: {
        position: 'absolute',
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    instructionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    instructionSubtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    instructionHint: {
        fontSize: 14,
        fontWeight: '400',
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});
