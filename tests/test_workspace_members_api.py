import asyncio
import httpx
import os
from bson import ObjectId

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@example.com"
MEMBER_EMAIL = "member@example.com"
WORKSPACE_ID = "test-ws-members-v2"

async def main():
    print("🚀 Starting Workspace Member API Tests")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        
        # Health Check
        try:
            print("   Checking server health...")
            resp = await client.get("/")
            print(f"   Server health: {resp.status_code}")
        except Exception as e:
            print(f"   ⚠️ Server might be down or unreachable: {e}")

        headers_admin = {
            "X-Account-Gmail": ADMIN_EMAIL
        }
        headers_member = {
            "X-Account-Gmail": MEMBER_EMAIL
        }
        
        # 1. Create Workspace (as Admin)
        print("\n1. Creating Workspace...")
        # This will auto-create the admin account if it doesn't exist
        
        payload = {
            "bot_token": "xoxb-test",
            "workspace_name": "Test Workspace",
            "workspace_id": WORKSPACE_ID
        }
        
        try:
            resp = await client.post("/workspace/make-workspace", json=payload, headers=headers_admin)
            print(f"   Response: {resp.status_code} {resp.text}")
            if resp.status_code == 200:
                print("   ✅ Workspace created")
                data = resp.json()
                # Capture admin ID if needed, though we don't strictly need it for add_member
                admin_id = data["workspace"]["account_id"]
                print(f"   Admin ID: {admin_id}")
            elif resp.status_code == 400 and "already exists" in resp.text:
                print("   ⚠️ Workspace already exists (continuing)")
            else:
                print("   ❌ Failed to create workspace")
                return
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"   ❌ Error: {e}")
            return

        # 2. Ensure Member Account Exists
        print("\n2. Ensuring Member Account Exists...")
        # We can try to create a dummy workspace for the member to force account creation
        dummy_payload = {
            "bot_token": "xoxb-dummy",
            "workspace_name": "Dummy Workspace",
            "workspace_id": f"dummy-{os.urandom(4).hex()}"
        }
        try:
            resp = await client.post("/workspace/make-workspace", json=dummy_payload, headers=headers_member)
            if resp.status_code == 200:
                print("   ✅ Member account created (via dummy workspace)")
                member_id = resp.json()["workspace"]["account_id"]
                print(f"   Member ID: {member_id}")
            else:
                print(f"   ⚠️ Failed to create dummy workspace: {resp.status_code}")
        except Exception as e:
            print(f"   ❌ Error creating member account: {e}")

        # 3. Add Member
        print("\n3. Adding Member...")
        add_payload = {"email": MEMBER_EMAIL}
        resp = await client.post(f"/workspace/{WORKSPACE_ID}/members", json=add_payload, headers=headers_admin)
        print(f"   Response: {resp.status_code} {resp.text}")
        if resp.status_code == 200:
            print("   ✅ Member added")
        else:
            print("   ❌ Failed to add member")

        # 4. List Members
        print("\n4. Listing Members...")
        resp = await client.get(f"/workspace/{WORKSPACE_ID}/members", headers=headers_admin)
        print(f"   Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            members = data.get("members", [])
            print(f"   Found {len(members)} members")
            for m in members:
                print(f"   - {m['username']} ({m['email']}) [{m['role']}]")
            
            # Verify member is in list
            member_emails = [m['email'] for m in members]
            if MEMBER_EMAIL in member_emails:
                print("   ✅ Member found in list")
            else:
                print("   ❌ Member NOT found in list")
        else:
            print("   ❌ Failed to list members")

        # 5. Remove Member
        print("\n5. Removing Member...")
        # We need member's account ID. We captured it earlier or can find it in the list.
        # Let's find it in the list to be safe
        target_member_id = None
        if resp.status_code == 200:
            for m in members:
                if m['email'] == MEMBER_EMAIL:
                    target_member_id = m['id']
                    break
        
        if target_member_id:
            resp = await client.delete(f"/workspace/{WORKSPACE_ID}/members/{target_member_id}", headers=headers_admin)
            print(f"   Response: {resp.status_code} {resp.text}")
            if resp.status_code == 200:
                print("   ✅ Member removed")
            else:
                print("   ❌ Failed to remove member")
        else:
            print("   ❌ Could not find member ID to remove")

        # 6. Verify Removal
        print("\n6. Verifying Removal...")
        resp = await client.get(f"/workspace/{WORKSPACE_ID}/members", headers=headers_admin)
        if resp.status_code == 200:
            members = resp.json().get("members", [])
            member_emails = [m['email'] for m in members]
            if MEMBER_EMAIL not in member_emails:
                print("   ✅ Member successfully removed")
            else:
                print("   ❌ Member still in list")

if __name__ == "__main__":
    asyncio.run(main())
