import sys
import os
import bcrypt

# Ensure we can load paths from the backend module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

from database import get_supabase

def hash_password(password: str) -> str:
    # Match the bcrypt config used in auth
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def main():
    print("=============================================")
    print("   🎓 ADD NEW STUDENT UTILITY")
    print("=============================================")
    
    roll = input("\n📝 Enter new Student Roll Number (e.g. 10411): ").strip()
    name = input("📝 Enter full Student Name: ").strip()
    division = input("📝 Enter Division (e.g. A, B, C): ").strip()
    
    if not roll or not name or not division:
        print("❌ All fields are required.")
        return

    password = "password123"
    print(f"\n⏳ Creating account for {name}... (Default Password: {password})")
    hashed_pwd = hash_password(password)
    
    db = get_supabase()
    
    try:
        # 1. Insert into users table
        user_res = db.table("users").insert({
            "role": "student",
            "password_hash": hashed_pwd
        }).execute()
        
        user_id = user_res.data[0]["id"]
        
        # 2. Insert into students table
        db.table("students").insert({
            "id": user_id,
            "roll": roll,
            "name": name,
            "division": division,
            "semester": "6"
        }).execute()
        
        print("\n✅ SUCCESS!")
        print(f"Student: {name}")
        print(f"Login ID / Roll: {roll}")
        print(f"Password: {password}")
        print("\n👉 Next steps:")
        print(f"1. Run 'python local_camera_register.py' and enter {roll} to scan their face.")
        print(f"2. Log in on the mobile app with Roll: {roll} and Password: {password}")
        
    except Exception as e:
        print(f"❌ Failed to create student: {str(e)}")

if __name__ == "__main__":
    main()
