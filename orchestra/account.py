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

router = APIRouter(prefix="/account", tags=["account"])


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


@router.delete("/delete-all")
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

    # 14. Delete saved tokens
    tokens_collection = get_collection("tokens")
    result = await tokens_collection.delete_many({"user_email": user_email})
    deleted["tokens"] = result.deleted_count

    # 15. Finally delete account
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


@router.get("/tokens")
async def get_saved_tokens(request: Request):
    """Get user's saved Slack tokens from tokens collection."""
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    tokens_collection = get_collection("tokens")
    tokens_cursor = tokens_collection.find({"user_email": user_email})
    tokens_list = await tokens_cursor.to_list(length=100)

    # Format tokens for response (mask the token value)
    tokens = []
    for t in tokens_list:
        token_value = t.get("token", "")
        # Show last 8 characters with mask
        if len(token_value) > 8:
            masked = "•••••••" + token_value[-8:]
        else:
            masked = "•••••••"
        tokens.append({
            "id": str(t["_id"]),
            "name": t.get("name", "Unnamed Token"),
            "token": token_value,
            "masked": masked,
            "created_at": t.get("created_at")
        })

    return {
        "success": True,
        "tokens": tokens
    }


@router.post("/tokens")
async def save_token(request: Request):
    """Save a new Slack token to tokens collection."""
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    data = await request.json()
    token = data.get("token")
    name = data.get("name", "Unnamed Token")

    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    if not name:
        raise HTTPException(status_code=400, detail="Token name is required")

    tokens_collection = get_collection("tokens")

    # Check if token already exists for this user
    existing = await tokens_collection.find_one({
        "user_email": user_email,
        "token": token
    })

    if existing:
        raise HTTPException(status_code=400, detail="Token already saved")

    # Insert new token
    result = await tokens_collection.insert_one({
        "user_email": user_email,
        "name": name,
        "token": token,
        "created_at": datetime.utcnow()
    })

    return {
        "success": True,
        "token_id": str(result.inserted_id)
    }


@router.delete("/tokens/{token_id}")
async def delete_token(request: Request, token_id: str):
    """Delete a saved Slack token by ID."""
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    tokens_collection = get_collection("tokens")

    result = await tokens_collection.delete_one({
        "_id": ObjectId(token_id),
        "user_email": user_email
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")

    return {"success": True}