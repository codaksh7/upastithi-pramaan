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


def get_face_encoding_from_bytes(image_bytes: bytes) -> list[float]:
    """
    Takes raw image bytes (from an uploaded file),
    detects exactly one face, and returns a 128-float embedding.

    Raises ValueError if 0 or 2+ faces are found.
    """
    # Convert bytes → PIL Image → numpy array (RGB)
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(pil_image)

    # Detect face locations
    face_locations = face_recognition.face_locations(image_np)

    if len(face_locations) == 0:
        raise ValueError("No face detected. Make sure your face is clearly visible.")

    if len(face_locations) > 1:
        raise ValueError("Multiple faces detected. Please upload a single face image.")

    # Generate 128-d embedding
    encoding = face_recognition.face_encodings(image_np, face_locations)[0]

    # Return as plain Python list (JSON-serializable for Supabase JSONB)
    return encoding.tolist()


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
