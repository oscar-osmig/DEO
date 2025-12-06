"""
Workspace Management Module (Alternative)

This module provides an alternative workspace creation endpoint that doesn't
require session-based authentication. Useful for direct API access.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_collection
from datetime import datetime

router = APIRouter(prefix="/workspace", tags=["workspace"])


class CreateWorkspaceRequest(BaseModel):
    """
    Request model for creating a workspace without session authentication.
    """
    username: str
    account_id: str
    bot_token: str
    workspace_name: str
    workspace_id: str


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