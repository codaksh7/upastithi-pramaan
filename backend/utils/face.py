"""
utils/face.py
Face embedding generation and comparison logic.
Mirrors Phase 1 prototype — just adapted for API use (bytes instead of file paths).
"""
import numpy as np
import face_recognition
from PIL import Image
import io


THRESHOLD = 0.5  # 0.4 = strict | 0.5 = balanced | 0.6 = lenient


def get_face_data_from_bytes(image_bytes: bytes) -> tuple[list[float], dict]:
    """
    Takes raw image bytes, detects exactly one face, and returns a tuple of
    (128-float embedding, face_landmarks dict).
    """
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(pil_image)

    face_locations = face_recognition.face_locations(image_np)

    if len(face_locations) == 0:
        raise ValueError("No face detected. Make sure your face is clearly visible.")

    if len(face_locations) > 1:
        raise ValueError("Multiple faces detected. Please upload a single face image.")

    encoding = face_recognition.face_encodings(image_np, face_locations)[0]
    
    landmarks_list = face_recognition.face_landmarks(image_np, face_locations)
    landmarks = landmarks_list[0] if landmarks_list else {}

    return encoding.tolist(), landmarks


def get_face_encoding_from_bytes(image_bytes: bytes) -> list[float]:
    """Fallback legacy method for scripts that only want the embedding."""
    enc, _ = get_face_data_from_bytes(image_bytes)
    return enc


def verify_liveness(landmarks: dict, challenge: str) -> bool:
    """
    Evaluates geometric heuristics on 68 tracking points to prove 3D liveness.
    """
    if not challenge:
        return True
    
    challenge = challenge.upper()
    chin = landmarks.get("chin", [])
    if len(chin) < 17:
        return False
        
    face_width = abs(chin[16][0] - chin[0][0])
    
    if challenge == "SMILE":
        top_lip = landmarks.get("top_lip", [])
        if len(top_lip) < 7:
            return False
        mouth_width = abs(top_lip[6][0] - top_lip[0][0])
        # A standard neutral mouth is ~0.33 of face width. A smile pushes it > 0.38.
        return (mouth_width / face_width) > 0.38
        
    elif challenge == "TURN_HEAD":
        nose_tip = landmarks.get("nose_tip", [])
        if len(nose_tip) < 3:
            return False
        nose_x = nose_tip[2][0]
        
        # Check distance from nose to the left/right extreme bounds of the face
        dist_to_left = abs(chin[16][0] - nose_x)
        dist_to_right = abs(chin[0][0] - nose_x)
        
        # If the head is turned, the nose will be much closer to one side of the 2D bounding box
        if min(dist_to_left, dist_to_right) == 0:
            return True
        ratio = max(dist_to_left, dist_to_right) / min(dist_to_left, dist_to_right)
        
        # Ratio > 1.35 indicates a significant 3D head yaw rotation
        return ratio > 1.35
        
    return True

def compare_encodings(
    stored_embedding: list[float],
    incoming_embedding: list[float]
) -> tuple[bool, float, float]:
    """
    Compares two face embeddings.

    Returns:
        is_match   (bool)  — True if same person
        distance   (float) — lower = more similar
        similarity (float) — percentage 0–100
    """
    enc1 = np.array(stored_embedding)
    enc2 = np.array(incoming_embedding)

    distance = face_recognition.face_distance([enc1], enc2)[0]
    similarity = round((1 - distance) * 100, 2)
    is_match = bool(distance < THRESHOLD)

    return is_match, float(distance), similarity
