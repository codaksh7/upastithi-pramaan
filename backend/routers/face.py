"""
routers/face.py
Face recognition routes:
  POST /face/register    → upload face image for a student, store embedding
  POST /face/verify      → upload face image, compare vs stored, mark attendance
  GET  /face/attendance  → fetch all attendance records
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from database import get_supabase, safe_data
from utils.face import get_face_encoding_from_bytes, compare_encodings

router = APIRouter()


# ─────────────────────────────────────────────
# POST /face/register
# ─────────────────────────────────────────────
@router.post("/register", summary="Register a student's face")
async def register_face(
    student_id: str = Form(..., description="The student's unique ID"),
    image: UploadFile = File(..., description="Clear front-facing photo of the student"),
):
    """
    Accepts a student ID and face image.
    Generates a 128-d face embedding and stores it in Supabase.
    Only one embedding per student — re-registering updates it.
    """
    # ── Read uploaded image bytes
    image_bytes = await image.read()

    # ── Generate face embedding
    try:
        embedding = get_face_encoding_from_bytes(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    supabase = get_supabase()

    # ── Check if student already registered
    existing = (
        supabase.table("face_embeddings")
        .select("id")
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )

    if safe_data(existing):
        # Update existing embedding
        supabase.table("face_embeddings")\
            .update({"embedding": embedding})\
            .eq("student_id", student_id)\
            .execute()
    else:
        # Insert new embedding
        supabase.table("face_embeddings")\
            .insert({"student_id": student_id, "embedding": embedding})\
            .execute()

    return {
        "success": True,
        "message": f"Face registered successfully for student {student_id}",
        "student_id": student_id,
    }


# ─────────────────────────────────────────────
# POST /face/verify
# ─────────────────────────────────────────────
@router.post("/verify", summary="Verify a student's face and mark attendance")
async def verify_face(
    student_id: str = Form(..., description="The student's unique ID to verify against"),
    image: UploadFile = File(..., description="Live face image to verify"),
):
    """
    Accepts a student ID and live face image.
    Compares against stored embedding.
    If matched → marks attendance with timestamp.
    """
    # ── Read uploaded image bytes
    image_bytes = await image.read()

    # ── Generate embedding for incoming image
    try:
        incoming_embedding = get_face_encoding_from_bytes(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── Fetch stored embedding for this student
    supabase = get_supabase()
    res = (
        supabase.table("face_embeddings")
        .select("embedding")
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )

    data = safe_data(res)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No registered face found for student {student_id}. Please register first.",
        )

    stored_embedding = data["embedding"]

    # ── Compare faces
    is_match, distance, similarity = compare_encodings(stored_embedding, incoming_embedding)

    # ── If matched → mark attendance
    if is_match:
        supabase.table("face_attendance").insert({
            "student_id": student_id,
            "similarity": similarity,
            "distance": distance,
        }).execute()

    return {
        "success": True,
        "student_id": student_id,
        "matched": is_match,
        "similarity": similarity,
        "distance": round(distance, 4),
        "message": "✅ Face Recognized — Attendance Marked" if is_match else "❌ Face Not Recognized",
    }


# ─────────────────────────────────────────────
# GET /face/attendance
# ─────────────────────────────────────────────
@router.get("/attendance", summary="Get all face attendance records")
def get_attendance(student_id: str | None = None):
    """
    Returns all attendance records.
    Optionally filter by student_id using query param:
      GET /face/attendance?student_id=STU001
    """
    supabase = get_supabase()

    query = (
        supabase.table("face_attendance")
        .select("*")
        .order("verified_at", desc=True)
    )

    if student_id:
        query = query.eq("student_id", student_id)

    res = query.execute()
    data = safe_data(res)

    return {
        "success": True,
        "count": len(data) if data else 0,
        "records": data or [],
    }