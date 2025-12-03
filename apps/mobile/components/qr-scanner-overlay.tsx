import { StyleSheet } from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

interface QRScannerOverlayProps {
    width: number;
    height: number;
    scannerSize: number;
    scannerTop: number;
    scannerLeft: number;
    borderRadius: number;
}

export default function QRScannerOverlay({
    width,
    height,
    scannerSize,
    scannerTop,
    scannerLeft,
    borderRadius,
}: QRScannerOverlayProps) {
    return (
        <Svg height={height} width={width} style={styles.svgOverlay}>
            <Defs>
                <Mask id="mask" x="0" y="0" height="100%" width="100%">
                    <Rect height="100%" width="100%" fill="#fff" />
                    <Rect
                        x={scannerLeft}
                        y={scannerTop}
                        width={scannerSize}
                        height={scannerSize}
                        rx={borderRadius}
                        ry={borderRadius}
                        fill="#000"
                    />
                </Mask>
            </Defs>
            <Rect
                height="100%"
                width="100%"
                fill="rgba(0, 0, 0, 0.5)"
                mask="url(#mask)"
            />
        </Svg>
    );
}

const styles = StyleSheet.create({
    svgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});

