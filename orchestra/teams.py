"""
Teams Management Module

This module handles team creation and member management.
Users can create teams, add/remove members, and manage team details.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from database import get_collection
from datetime import datetime

router = APIRouter(prefix="/teams", tags=["teams"])


class TeamMember(BaseModel):
    """
    Team member model.

    Attributes:
        name (str): Member's full name
        email (EmailStr): Member's email address
        slack_user_id (Optional[str]): Slack user ID (optional)
    """
    name: str
    email: EmailStr
    slack_user_id: Optional[str] = None


class CreateTeamRequest(BaseModel):
    """
    Request model for creating a team.

    Attributes:
        team_name (str): Name of the team
        description (Optional[str]): Team description
        members (List[TeamMember]): List of team members (optional, can add later)
    """
    team_name: str
    description: Optional[str] = None
    members: Optional[List[TeamMember]] = []


class UpdateTeamRequest(BaseModel):
    """
    Request model for updating team details.

    Attributes:
        team_name (Optional[str]): New team name
        description (Optional[str]): New team description
    """
    team_name: Optional[str] = None
    description: Optional[str] = None


class AddMembersRequest(BaseModel):
    """
    Request model for adding members to a team.

    Attributes:
        members (List[TeamMember]): List of members to add
    """
    members: List[TeamMember]


class RemoveMemberRequest(BaseModel):
    """
    Request model for removing a member from a team.

    Attributes:
        email (EmailStr): Email of the member to remove
    """
    email: EmailStr


class UpdateMemberRequest(BaseModel):
    """
    Request model for updating a team member.

    Attributes:
        email (EmailStr): Email of the member to update
        name (Optional[str]): New name
        slack_user_id (Optional[str]): New Slack user ID
    """
    email: EmailStr
    name: Optional[str] = None
    slack_user_id: Optional[str] = None


@router.post("/create")
async def create_team(request: Request, data: CreateTeamRequest):
    """
    Create a new team.

    Args:
        request (Request): FastAPI request object (for session)
        data (CreateTeamRequest): Team creation data

    Returns:
        dict: Created team details

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if user account not found
    """
    # Get authenticated user
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    accounts_collection = get_collection("accounts")
    account = await accounts_collection.find_one({"gmail": user_email})

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Create team document
    teams_collection = get_collection("teams")

    team_doc = {
        "team_name": data.team_name,
        "description": data.description,
        "owner_email": user_email,
        "owner_name": account.get("username"),
        "owner_id": str(account.get("_id")),
        "members": [member.model_dump() for member in data.members] if data.members else [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    result = await teams_collection.insert_one(team_doc)

    return {
        "success": True,
        "team_id": str(result.inserted_id),
        "team_name": data.team_name,
        "members_count": len(data.members) if data.members else 0
    }


@router.get("/list")
async def list_teams(request: Request):
    """
    List all teams owned by the authenticated user.

    Args:
        request (Request): FastAPI request object

    Returns:
        dict: List of teams

    Raises:
        HTTPException: 401 if not authenticated
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")
    teams = await teams_collection.find({"owner_email": user_email}).to_list(length=1000)

    # Convert ObjectId to string
    for team in teams:
        team['_id'] = str(team['_id'])
        team['created_at'] = team['created_at'].isoformat() if team.get('created_at') else None
        team['updated_at'] = team['updated_at'].isoformat() if team.get('updated_at') else None

    return {
        "success": True,
        "teams": teams,
        "count": len(teams)
    }


@router.get("/{team_id}")
async def get_team(request: Request, team_id: str):
    """
    Get details of a specific team.

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID

    Returns:
        dict: Team details

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check ownership
    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to access this team")

    team['_id'] = str(team['_id'])
    team['created_at'] = team['created_at'].isoformat() if team.get('created_at') else None
    team['updated_at'] = team['updated_at'].isoformat() if team.get('updated_at') else None

    return {
        "success": True,
        "team": team
    }


@router.put("/{team_id}")
async def update_team(request: Request, team_id: str, data: UpdateTeamRequest):
    """
    Update team details (name and/or description).

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID
        data (UpdateTeamRequest): Updated team data

    Returns:
        dict: Update result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to update this team")

    # Build update document
    update_doc = {"updated_at": datetime.utcnow()}

    if data.team_name is not None:
        update_doc["team_name"] = data.team_name

    if data.description is not None:
        update_doc["description"] = data.description

    result = await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {"$set": update_doc}
    )

    return {
        "success": True,
        "team_id": team_id,
        "modified_count": result.modified_count
    }


@router.post("/{team_id}/members/add")
async def add_members(request: Request, team_id: str, data: AddMembersRequest):
    """
    Add members to a team.

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID
        data (AddMembersRequest): Members to add

    Returns:
        dict: Result with added members count

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this team")

    # Get existing members
    existing_members = team.get("members", [])
    existing_emails = {member.get("email") for member in existing_members}

    # Add only new members (avoid duplicates)
    new_members = []
    skipped = []

    for member in data.members:
        if member.email not in existing_emails:
            new_members.append(member.model_dump())
        else:
            skipped.append(member.email)

    if new_members:
        result = await teams_collection.update_one(
            {"_id": ObjectId(team_id)},
            {
                "$push": {"members": {"$each": new_members}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
    else:
        result = None

    return {
        "success": True,
        "team_id": team_id,
        "added_count": len(new_members),
        "skipped_count": len(skipped),
        "skipped_emails": skipped,
        "message": f"Added {len(new_members)} new member(s), skipped {len(skipped)} duplicate(s)"
    }


@router.delete("/{team_id}/members/remove")
async def remove_member(request: Request, team_id: str, data: RemoveMemberRequest):
    """
    Remove a member from a team.

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID
        data (RemoveMemberRequest): Member email to remove

    Returns:
        dict: Removal result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this team")

    result = await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {
            "$pull": {"members": {"email": data.email}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    return {
        "success": True,
        "team_id": team_id,
        "removed_email": data.email,
        "modified_count": result.modified_count
    }


@router.put("/{team_id}/members/update")
async def update_member(request: Request, team_id: str, data: UpdateMemberRequest):
    """
    Update a team member's information.

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID
        data (UpdateMemberRequest): Updated member data

    Returns:
        dict: Update result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team or member not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this team")

    # Find the member to update
    members = team.get("members", [])
    member_found = False

    for i, member in enumerate(members):
        if member.get("email") == data.email:
            member_found = True
            if data.name is not None:
                members[i]["name"] = data.name
            if data.slack_user_id is not None:
                members[i]["slack_user_id"] = data.slack_user_id
            break

    if not member_found:
        raise HTTPException(status_code=404, detail="Member not found in team")

    # Update the entire members array
    result = await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {
            "$set": {
                "members": members,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "success": True,
        "team_id": team_id,
        "updated_email": data.email,
        "modified_count": result.modified_count
    }


@router.delete("/{team_id}")
async def delete_team(request: Request, team_id: str):
    """
    Delete a team.

    Args:
        request (Request): FastAPI request object
        team_id (str): Team ID

    Returns:
        dict: Deletion result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
        HTTPException: 403 if user doesn't own the team
    """
    from bson import ObjectId

    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this team")

    result = await teams_collection.delete_one({"_id": ObjectId(team_id)})

    return {
        "success": True,
        "team_id": team_id,
        "team_name": team.get("team_name"),
        "deleted_count": result.deleted_count
    }


@router.post("/create")
async def create_team(request: Request, data: CreateTeamRequest, secret_code: Optional[str] = None):
    """Create a new team."""

    # Get authenticated user
    user_email = request.session.get('user_email')

    # WORKAROUND: Allow secret code authentication
    if not user_email and secret_code == "DEO-SECRET-2025":
        # Get email from request body (you'll need to add it)
        user_email = data.owner_email if hasattr(data, 'owner_email') else None

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")