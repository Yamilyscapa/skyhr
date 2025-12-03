import { Face } from "@react-native-ml-kit/face-detection";

export function isFaceCentered(face: Face, imageWidth: number, imageHeight: number): boolean {
    const { frame } = face;
    
    const faceCenterX = frame.left + frame.width / 2;
    const faceCenterY = frame.top + frame.height / 2;
    
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;
    
    const deviationX = Math.abs(faceCenterX - imageCenterX) / imageWidth;
    const deviationY = Math.abs(faceCenterY - imageCenterY) / imageHeight;
    
    const isHorizontallyCentered = deviationX < 0.15;
    const isVerticallyCentered = deviationY < 0.20;
    
    const faceWidthRatio = frame.width / imageWidth;
    const faceHeightRatio = frame.height / imageHeight;
    const isSizeAppropriate = faceWidthRatio > 0.3 && faceWidthRatio < 0.85 &&
                              faceHeightRatio > 0.3 && faceHeightRatio < 0.85;
    
    const isCentered = isHorizontallyCentered && isVerticallyCentered && isSizeAppropriate;
    
    if (!isCentered) {
        console.log('📊 Análisis del rostro:', {
            deviationX: (deviationX * 100).toFixed(1) + '%',
            deviationY: (deviationY * 100).toFixed(1) + '%',
            faceWidthRatio: (faceWidthRatio * 100).toFixed(1) + '%',
            faceHeightRatio: (faceHeightRatio * 100).toFixed(1) + '%',
            isHorizontallyCentered,
            isVerticallyCentered,
            isSizeAppropriate,
        });
    }
    
    return isCentered;
}

export function filterValidFaces(
    faces: Face[],
    imageWidth: number,
    imageHeight: number
): Face[] {
    return faces.filter(face => isFaceCentered(face, imageWidth, imageHeight));
}

