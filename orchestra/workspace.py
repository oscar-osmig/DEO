"""
Workspace Management Module (Alternative)

This module provides an alternative workspace creation endpoint that doesn't
require session-based authentication. Useful for direct API access.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import get_collection
from datetime import datetime
from bson import ObjectId
import uuid
import httpx

router = APIRouter(prefix="/workspace", tags=["workspace"])


class CreateWorkspaceRequest(BaseModel):
    """
    Request model for creating a workspace without session authentication.
    """
    username: str
    account_id: str
    gmail: str = ""
    bot_token: str
    workspace_name: str
    workspace_id: str

@router.get("/list")
async def list_workspaces(request: Request):
    """Get all workspaces for the current authenticated user."""
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    workspaces_collection = get_collection("workspaces")

    cursor = workspaces_collection.find({"gmail": user_email})
    workspaces = await cursor.to_list(length=100)

    for ws in workspaces:
        ws['_id'] = str(ws['_id'])

    return {
        "success": True,
        "workspaces": workspaces
    }

class CreateWorkspaceSimple(BaseModel):
    """Simple workspace creation with just name and token."""
    workspace_name: str
    bot_token: str
    allow_duplicate_token: bool = False


@router.post("/create")
async def create_workspace(request: Request, data: CreateWorkspaceSimple):
    """Create a new workspace using session authentication."""
    user_email = request.session.get('user_email')
    user_name = request.session.get('user_name', '')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    workspaces_collection = get_collection("workspaces")
    accounts_collection = get_collection("accounts")

    # Get account info
    account = await accounts_collection.find_one({"gmail": user_email})
    account_id = str(account["_id"]) if account else user_email

    # Check if workspace with same token already exists for this user
    if not data.allow_duplicate_token:
        existing = await workspaces_collection.find_one({
            "gmail": user_email,
            "bot_token": data.bot_token
        })
        if existing:
            raise HTTPException(status_code=400, detail="Workspace with this token already exists")

    workspace_doc = {
        "username": user_name,
        "account_id": account_id,
        "gmail": user_email,
        "bot_token": data.bot_token,
        "workspace_name": data.workspace_name,
        "workspace_id": f"workspace-{uuid.uuid4().hex[:16]}",
        "admins": [account_id],
        "members": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    result = await workspaces_collection.insert_one(workspace_doc)

    return {
        "success": True,
        "workspace_id": str(result.inserted_id),
        "id": str(result.inserted_id)
    }


@router.delete("/{workspace_id}")
async def delete_workspace(request: Request, workspace_id: str):
    """Delete a workspace by MongoDB _id."""
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    workspaces_collection = get_collection("workspaces")

    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Verify ownership
    if workspace.get("gmail") != user_email:
        raise HTTPException(status_code=403, detail="Not authorized to delete this workspace")

    await workspaces_collection.delete_one({"_id": ObjectId(workspace_id)})

    return {"success": True}


@router.post("/make-workspace")
async def make_workspace(request: CreateWorkspaceRequest):
    """
    Create a new workspace without requiring session authentication.
    """
    workspaces_collection = get_collection("workspaces")

    existing = await workspaces_collection.find_one({"workspace_id": request.workspace_id})
    if existing:
        raise HTTPException(status_code=400, detail="Workspace already exists")

    workspace_doc = {
        "username": request.username,
        "account_id": request.account_id,
        "gmail": request.gmail or request.account_id,
        "bot_token": request.bot_token,
        "workspace_name": request.workspace_name,
        "workspace_id": request.workspace_id,
        "admins": [request.account_id],
        "members": [],
        "created_at": datetime.utcnow()
    }

    result = await workspaces_collection.insert_one(workspace_doc)

    return {
        "success": True,
        "workspace_id": request.workspace_id,
        "id": str(result.inserted_id)
    }


@router.get("/by-id/{workspace_id}")
async def get_workspace_by_id(workspace_id: str):
    """Get workspace by ID."""
    workspaces_collection = get_collection("workspaces")

    workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace['_id'] = str(workspace['_id'])

    return {
        "success": True,
        "workspace": workspace
    }


@router.get("/by-name/{workspace_name}")
async def get_workspace_by_name(workspace_name: str):
    """Get workspace by name."""
    workspaces_collection = get_collection("workspaces")

    workspace = await workspaces_collection.find_one({"workspace_name": workspace_name})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace['_id'] = str(workspace['_id'])

    return {
        "success": True,
        "workspace": workspace
    }


@router.get("/by-account/{account_id}")
async def get_workspaces_by_account(account_id: str):
    """Get all workspaces for an account (by account_id or gmail)."""
    workspaces_collection = get_collection("workspaces")

    # Search by account_id OR gmail (email)
    cursor = workspaces_collection.find({
        "$or": [
            {"account_id": account_id},
            {"gmail": account_id}
        ]
    })
    workspaces = await cursor.to_list(length=100)

    for ws in workspaces:
        ws['_id'] = str(ws['_id'])

    return {
        "success": True,
        "workspaces": workspaces
    }


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str):
    """Get workspace by MongoDB _id."""
    workspaces_collection = get_collection("workspaces")

    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace['_id'] = str(workspace['_id'])

    return {
        "success": True,
        "workspace": workspace
    }


@router.get("/{workspace_id}/channels")
async def get_slack_channels(workspace_id: str):
    """Get all Slack channels for a workspace using the bot token."""
    workspaces_collection = get_collection("workspaces")

    # Try to find workspace by MongoDB _id first, then by workspace_id
    workspace = None
    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
    except:
        pass

    if not workspace:
        workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    bot_token = workspace.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Workspace has no bot token configured")

    # Fetch channels from Slack API
    url = "https://slack.com/api/conversations.list"
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }
    params = {
        "types": "public_channel,private_channel",
        "exclude_archived": "true",
        "limit": 200
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()

    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=f"Slack API error: {data.get('error')}")

    # Extract channel info
    channels = []
    for channel in data.get("channels", []):
        channels.append({
            "id": channel.get("id"),
            "name": channel.get("name"),
            "is_private": channel.get("is_private", False),
            "num_members": channel.get("num_members", 0)
        })

    return {
        "success": True,
        "channels": channels
    }


@router.get("/{workspace_id}/users")
async def get_slack_users(workspace_id: str):
    """Get all Slack users for a workspace using the bot token."""
    workspaces_collection = get_collection("workspaces")

    # Try to find workspace by MongoDB _id first, then by workspace_id
    workspace = None
    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
    except:
        pass

    if not workspace:
        workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    bot_token = workspace.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Workspace has no bot token configured")

    # Fetch users from Slack API
    url = "https://slack.com/api/users.list"
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        data = response.json()

    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=f"Slack API error: {data.get('error')}")

    # Extract user info (exclude bots and deleted users)
    users = []
    for user in data.get("members", []):
        if user.get("deleted") or user.get("is_bot"):
            continue
        # Skip Slackbot
        if user.get("id") == "USLACKBOT":
            continue

        users.append({
            "id": user.get("id"),
            "name": user.get("name"),
            "real_name": user.get("real_name", user.get("name")),
            "display_name": user.get("profile", {}).get("display_name", ""),
            "avatar": user.get("profile", {}).get("image_48", "")
        })

    return {
        "success": True,
        "users": users
    }