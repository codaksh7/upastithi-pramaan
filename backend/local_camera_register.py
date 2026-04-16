import cv2
import sys
import os
import json

# Ensure we can load paths from the backend module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

from database import get_supabase
from utils.face import get_face_encoding_from_bytes, face_recognition

def capture_face_from_camera():
    print("\n📷 Opening camera...")
    print("   Press  S  to capture your face")
    print("   Press  Q  to quit\n")

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Could not open camera. Check if it's connected.")
        sys.exit(1)

    captured_frame = None

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read from camera.")
            break

        # Show live feed with instruction overlay
        display = frame.copy()
        cv2.putText(display, "Press S to capture | Q to quit",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imshow("Registration - Face Capture", display)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('s') or key == ord('S'):
            captured_frame = frame
            print("✅ Face captured!")
            break

        elif key == ord('q') or key == ord('Q'):
            print("⚠️  Capture cancelled by user.")
            break

    cap.release()
    cv2.destroyAllWindows()

    if captured_frame is None:
        sys.exit(0)

    return captured_frame

def main():
    print("=============================================")
    print("   🧠 FACE REGISTRATION UTILITY")
    print("=============================================")
    
    roll_number = input("\n📝 Enter your Student Roll Number (e.g. 101, 202): ").strip()
    if not roll_number:
        print("❌ Roll number cannot be empty.")
        return

    # Check student first
    db = get_supabase()
    student_res = db.table("students").select("id, name").eq("roll", roll_number).maybe_single().execute()
    student_data = student_res.data
    
    if not student_data:
        print(f"❌ Student with roll {roll_number} not found in database.")
        return
        
    print(f"✅ Found Student: {student_data['name']} (ID: {student_data['id']})")
    
    frame = capture_face_from_camera()
    
    # We need bytes for the utils.face function
    success, buffer = cv2.imencode(".jpg", frame)
    if not success:
        print("❌ Failed to encode image.")
        return
    
    image_bytes = buffer.tobytes()
    
    print("\n🔍 Processing face embedding...")
    try:
        embedding = get_face_encoding_from_bytes(image_bytes)
        print("✅ Face embedding generated successfully.")
    except Exception as e:
        print(f"❌ {str(e)}")
        return
        
    print("\n💾 Saving to Supabase...")
    # Update face_images column in Supabase
    face_images_array = [embedding]
    
    try:
        db.table("students").update({
            "face_images": face_images_array
        }).eq("id", student_data["id"]).execute()
        print("✅ Registration complete! You can now use your face for attendance.")
    except Exception as e:
        print(f"❌ Failed to save to database: {str(e)}")

if __name__ == "__main__":
    main()
