"""
Account Management Module

This module handles workspace creation for authenticated users.
It integrates with the session-based authentication system.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import get_collection
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/workspace", tags=["workspace"])


class MakeWorkspaceRequest(BaseModel):
    """
    Request model for creating a workspace.

    Attributes:
        bot_token (str): Slack bot token for the workspace
        workspace_name (str): Human-readable name for the workspace
        workspace_id (str): Unique identifier for the workspace
    """
    bot_token: str
    workspace_name: str
    workspace_id: str


@router.delete("/account/delete-all")
async def delete_account_and_all_data(request: Request):
    """
    Delete account and ALL associated data from every collection.
    """
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    accounts_collection = get_collection("accounts")
    account = await accounts_collection.find_one({"gmail": user_email})

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account_id = str(account["_id"])
    deleted = {}

    # 1. Delete sessions
    sessions_collection = get_collection("active_sessions")
    result = await sessions_collection.delete_many({"gmail": user_email})
    deleted["active_sessions"] = result.deleted_count

    # 2. Get all user's workspaces
    workspaces_collection = get_collection("workspaces")
    workspaces = await workspaces_collection.find({"gmail": user_email}).to_list(length=1000)
    workspace_ids = [w.get("workspace_id") for w in workspaces]

    # 3. Delete templates
    templates_collection = get_collection("templates")
    result = await templates_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["templates"] = result.deleted_count

    # 4. Delete pending executions
    pending_collection = get_collection("pending_executions")
    result = await pending_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["pending_executions"] = result.deleted_count

    # 5. Delete completed executions
    completed_collection = get_collection("completed_executions")
    result = await completed_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["completed_executions"] = result.deleted_count

    # 6. Delete failed executions
    failed_collection = get_collection("failed_executions")
    result = await failed_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["failed_executions"] = result.deleted_count

    # 7. Delete active schedules
    schedules_collection = get_collection("active_schedules")
    result = await schedules_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["active_schedules"] = result.deleted_count

    # 8. Delete scheduled executions log
    scheduled_log_collection = get_collection("scheduled_executions_log")
    result = await scheduled_log_collection.delete_many({"workspace_id": {"$in": workspace_ids}})
    deleted["scheduled_executions_log"] = result.deleted_count

    # 9. Delete teams
    teams_collection = get_collection("teams")
    teams = await teams_collection.find({"owner_email": user_email}).to_list(length=1000)
    team_ids = [str(t["_id"]) for t in teams]
    result = await teams_collection.delete_many({"owner_email": user_email})
    deleted["teams"] = result.deleted_count

    # 10. Delete dashboard templates
    dashboards_collection = get_collection("dashboard_templates")
    dashboards = await dashboards_collection.find({"owner_email": user_email}).to_list(length=1000)
    dashboard_ids = [str(d["_id"]) for d in dashboards]
    result = await dashboards_collection.delete_many({"owner_email": user_email})
    deleted["dashboard_templates"] = result.deleted_count

    # 11. Delete dashboard logins
    dashboard_logins = get_collection("dashboard_logins")
    result = await dashboard_logins.delete_many({"dashboard_id": {"$in": dashboard_ids}})
    deleted["dashboard_logins"] = result.deleted_count

    # 12. Delete dashboard data
    dashboard_data = get_collection("dashboard_data")
    result = await dashboard_data.delete_many({"dashboard_id": {"$in": dashboard_ids}})
    deleted["dashboard_data"] = result.deleted_count

    # 13. Delete workspaces
    result = await workspaces_collection.delete_many({"gmail": user_email})
    deleted["workspaces"] = result.deleted_count

    # 14. Finally delete account
    result = await accounts_collection.delete_one({"_id": ObjectId(account_id)})
    deleted["accounts"] = result.deleted_count

    # Clear session
    request.session.clear()

    return {
        "success": True,
        "message": "Account and all associated data deleted",
        "email": user_email,
        "deleted": deleted
    }


@router.post("/make-workspace")
async def make_workspace(request: Request, data: MakeWorkspaceRequest):
    """
    Create a new workspace for the authenticated user.
    """
    try:
        # Get user from session directly
        user_email = request.session.get('user_email')

        if not user_email:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Retrieve user account from database
        accounts_collection = get_collection("accounts")
        account = await accounts_collection.find_one({"gmail": user_email})

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Check if workspace ID already exists
        workspaces_collection = get_collection("workspaces")
        existing = await workspaces_collection.find_one({"workspace_id": data.workspace_id})
        if existing:
            raise HTTPException(status_code=400, detail="Workspace ID already exists")

        # Create workspace document
        username = account.get("username", "Unknown User")

        workspace_doc = {
            "username": username,
            "account_id": str(account["_id"]),
            "gmail": user_email,
            "bot_token": data.bot_token,
            "workspace_name": data.workspace_name,
            "workspace_id": data.workspace_id,
            "admins": [str(account["_id"])],
            "members": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await workspaces_collection.insert_one(workspace_doc)

        return {
            "success": True,
            "message": "Workspace created successfully",
            "workspace": {
                "id": str(result.inserted_id),
                "workspace_id": data.workspace_id,
                "workspace_name": data.workspace_name,
                "username": username,
                "account_id": str(account["_id"])
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")


class AddMemberRequest(BaseModel):
    email: str


@router.patch("/{workspace_id}/update-token")
async def update_workspace_token(workspace_id: str, request: Request):
    """Update a workspace's bot token."""
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    bot_token = body.get("bot_token")

    if not bot_token:
        raise HTTPException(status_code=400, detail="bot_token required")

    workspaces_collection = get_collection("workspaces")
    workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if workspace.get("gmail") != user_email:
        raise HTTPException(status_code=403, detail="Not authorized")

    await workspaces_collection.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"bot_token": bot_token, "updated_at": datetime.utcnow()}}
    )

    return {"success": True, "message": "Token updated", "workspace_id": workspace_id}

@router.post("/{workspace_id}/members")
async def add_member(workspace_id: str, request: Request, data: AddMemberRequest):
    """Add a member to the workspace."""
    # Authenticate
    from orchestra.permissions import is_workspace_admin
    user_id = await get_authenticated_user_id(request)
    
    if not await is_workspace_admin(user_id, workspace_id=workspace_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    accounts_collection = get_collection("accounts")
    new_member = await accounts_collection.find_one({"gmail": data.email})
    if not new_member:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_member_id = str(new_member["_id"])
    
    workspaces_collection = get_collection("workspaces")
    await workspaces_collection.update_one(
        {"workspace_id": workspace_id},
        {"$addToSet": {"members": new_member_id}}
    )
    
    return {"success": True, "message": "Member added"}


@router.delete("/{workspace_id}/members/{member_id}")
async def remove_member(workspace_id: str, member_id: str, request: Request):
    """Remove a member from the workspace."""
    # Authenticate
    from orchestra.permissions import is_workspace_admin
    user_id = await get_authenticated_user_id(request)
    
    if not await is_workspace_admin(user_id, workspace_id=workspace_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    workspaces_collection = get_collection("workspaces")
    await workspaces_collection.update_one(
        {"workspace_id": workspace_id},
        {"$pull": {"members": member_id, "admins": member_id}}
    )
    
    return {"success": True, "message": "Member removed"}


@router.get("/{workspace_id}/members")
async def get_members(workspace_id: str, request: Request):
    """List all members of the workspace."""
    # Authenticate (allow any member to view members?)
    # For now, let's restrict to members or admins
    from orchestra.permissions import is_workspace_admin
    user_id = await get_authenticated_user_id(request)
    
    workspaces_collection = get_collection("workspaces")
    workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Check if user is member or admin
    is_admin = await is_workspace_admin(user_id, workspace_doc=workspace)
    is_member = user_id in workspace.get("members", [])
    
    if not (is_admin or is_member):
         raise HTTPException(status_code=403, detail="Not authorized")

    member_ids = workspace.get("members", []) + workspace.get("admins", [])
    # Deduplicate
    member_ids = list(set(member_ids))
    
    accounts_collection = get_collection("accounts")
    from bson import ObjectId
    object_ids = [ObjectId(mid) for mid in member_ids if ObjectId.is_valid(mid)]
    
    members = await accounts_collection.find({"_id": {"$in": object_ids}}).to_list(length=1000)
    
    return {
        "success": True,
        "members": [
            {
                "id": str(m["_id"]),
                "username": m.get("username", "Unknown"),
                "email": m.get("gmail"),
                "picture": m.get("picture"),
                "role": "admin" if str(m["_id"]) in workspace.get("admins", []) else "member"
            }
            for m in members
        ]
    }

async def get_authenticated_user_id(request: Request):
    from orchestra.permissions import get_authenticated_account_id
    return await get_authenticated_account_id(request)