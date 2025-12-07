"""
Dashboards Management Module

This module handles dashboard creation, data submission, and access control.
Users can create dynamic dashboards for teams to track custom metrics.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from database import get_collection
from datetime import datetime, timedelta
from bson import ObjectId
import secrets

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class CreateDashboardRequest(BaseModel):
    """
    Request model for creating a dashboard.

    Attributes:
        dashboard_name (str): Name of the dashboard
        team_id (str): ID of the team this dashboard is for
        metrics (List[str]): List of metric names to track
        base_url (str): Base URL from frontend (e.g., "https://deo.com")
        reporting_period (str): How often to report (default: "weekly")
    """
    dashboard_name: str
    team_id: str
    metrics: List[str]
    base_url: str
    reporting_period: Optional[str] = "weekly"


class UpdateDashboardRequest(BaseModel):
    """
    Request model for updating dashboard details.

    Attributes:
        dashboard_name (Optional[str]): New dashboard name
        metrics (Optional[List[str]]): New metrics list
        is_active (Optional[bool]): Active status
    """
    dashboard_name: Optional[str] = None
    metrics: Optional[List[str]] = None
    is_active: Optional[bool] = None


class SubmitMetricsRequest(BaseModel):
    """
    Request model for team members to submit their metrics.

    Attributes:
        email (str): Team member's email
        metrics (Dict[str, Any]): Dictionary of metric_name: value
    """
    email: str
    metrics: Dict[str, Any]


def get_current_week():
    """Get current week identifier (e.g., 'week-2025-W45')."""
    now = datetime.utcnow()
    week_number = now.isocalendar()[1]
    year = now.year
    return f"week-{year}-W{week_number:02d}"


def get_week_range():
    """Get start and end datetime for current week (Monday to Sunday)."""
    now = datetime.utcnow()
    # Get Monday of current week
    start = now - timedelta(days=now.weekday())
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    # Get Sunday of current week
    end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return start, end


@router.post("/create")
async def create_dashboard(request: Request, data: CreateDashboardRequest):
    """
    Create a new dashboard for a team.

    This endpoint:
    1. Creates a dashboard template
    2. Generates a unique URL
    3. Creates login access document with team members
    4. Generates unique passcodes for each member

    Args:
        request (Request): FastAPI request object
        data (CreateDashboardRequest): Dashboard creation data

    Returns:
        dict: Created dashboard with URL and member passcodes

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if team not found
    """
    # Get authenticated user
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    accounts_collection = get_collection("accounts")
    account = await accounts_collection.find_one({"gmail": user_email})

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Get team details
    teams_collection = get_collection("teams")

    try:
        team = await teams_collection.find_one({"_id": ObjectId(data.team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify ownership
    if team.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this team")

    # Create dashboard template
    dashboard_templates = get_collection("dashboard_templates")

    template_doc = {
        "dashboard_name": data.dashboard_name,
        "team_id": data.team_id,
        "team_name": team.get("team_name"),
        "owner_email": user_email,
        "owner_name": account.get("username"),
        "metrics": data.metrics,
        "reporting_period": data.reporting_period,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }

    result = await dashboard_templates.insert_one(template_doc)
    dashboard_id = str(result.inserted_id)

    # Generate URL
    full_url = f"{data.base_url}/team-dashboard/{dashboard_id}"
    url_path = f"/team-dashboard/{dashboard_id}"

    # Create dashboard login access with unique passcodes
    dashboard_logins = get_collection("dashboard_logins")

    # Get team members and generate passcodes
    team_members = team.get("members", [])
    members_access = []

    for member in team_members:
        passcode = secrets.token_urlsafe(8)  # Generates 8-character passcode
        members_access.append({
            "email": member.get("email"),
            "name": member.get("name"),
            "slack_user_id": member.get("slack_user_id"),
            "passcode": passcode,
            "can_access": True
        })

    login_doc = {
        "dashboard_id": dashboard_id,
        "dashboard_name": data.dashboard_name,
        "url": full_url,
        "url_path": url_path,
        "members": members_access,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    await dashboard_logins.insert_one(login_doc)

    print(f"✅ Dashboard created: {data.dashboard_name}")
    print(f"   URL: {full_url}")
    print(f"   Members with access: {len(members_access)}")
    print(f"\n📧 Passcodes generated:")
    for member in members_access:
        print(f"   {member['name']} ({member['email']}): {member['passcode']}")

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "dashboard_name": data.dashboard_name,
        "url": full_url,
        "members_with_access": len(members_access),
        "metrics": data.metrics,
        "member_passcodes": [
            {
                "name": m["name"],
                "email": m["email"],
                "passcode": m["passcode"]
            }
            for m in members_access
        ]
    }


@router.get("/login/check")
async def check_dashboard_access(dashboard_id: str, email: str, passcode: str):
    """
    Check if a user can access a dashboard with email and passcode.
    """
    dashboard_logins = get_collection("dashboard_logins")

    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    if not login_doc:
        return {
            "access_granted": False,
            "detail": "Dashboard not found"
        }

    # Check if email and passcode match (case-insensitive email, strip whitespace)
    members = login_doc.get("members", [])
    user_member = None

    email_clean = email.lower().strip()
    passcode_clean = passcode.strip()

    for member in members:
        member_email = (member.get("email") or "").lower().strip()
        member_passcode = (member.get("passcode") or "").strip()

        if (member_email == email_clean and
            member_passcode == passcode_clean and
            member.get("can_access")):
            user_member = member
            break

    if not user_member:
        return {
            "access_granted": False,
            "detail": "Invalid email or passcode"
        }

    return {
        "access_granted": True,
        "member_name": user_member.get("name"),
        "member_email": user_member.get("email"),
        "dashboard_name": login_doc.get("dashboard_name")
    }


@router.get("/{dashboard_id}/passcodes")
async def get_dashboard_passcodes(request: Request, dashboard_id: str):
    """
    Get all member passcodes for a dashboard (owner only).

    Args:
        request (Request): FastAPI request object
        dashboard_id (str): Dashboard ID

    Returns:
        dict: List of members with their passcodes

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if dashboard not found
        HTTPException: 403 if user doesn't own the dashboard
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")

    try:
        template = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not template:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if template.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    # Get passcodes
    dashboard_logins = get_collection("dashboard_logins")
    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    if not login_doc:
        raise HTTPException(status_code=404, detail="Dashboard login info not found")

    members = login_doc.get("members", [])

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "dashboard_name": template.get("dashboard_name"),
        "members": [
            {
                "name": m.get("name"),
                "email": m.get("email"),
                "passcode": m.get("passcode"),
                "can_access": m.get("can_access")
            }
            for m in members
        ]
    }


@router.post("/{dashboard_id}/submit")
async def submit_metrics(dashboard_id: str, data: SubmitMetricsRequest):
    """
    Submit metrics data for a dashboard.

    Team members use this to report their weekly/monthly metrics.

    Args:
        dashboard_id (str): Dashboard ID
        data (SubmitMetricsRequest): Metrics data to submit

    Returns:
        dict: Submission result

    Raises:
        HTTPException: 404 if dashboard not found
        HTTPException: 403 if user not authorized
        HTTPException: 400 if metrics don't match template
    """
    # Verify access
    dashboard_logins = get_collection("dashboard_logins")
    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    if not login_doc:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Check if user is authorized
    members = login_doc.get("members", [])
    is_authorized = any(
        m.get("email") == data.email and m.get("can_access")
        for m in members
    )

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to submit to this dashboard")

    # Get dashboard template
    dashboard_templates = get_collection("dashboard_templates")

    try:
        template = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not template:
        raise HTTPException(status_code=404, detail="Dashboard template not found")

    # Validate metrics
    template_metrics = template.get("metrics", [])
    submitted_metrics = set(data.metrics.keys())
    expected_metrics = set(template_metrics)

    if submitted_metrics != expected_metrics:
        missing = expected_metrics - submitted_metrics
        extra = submitted_metrics - expected_metrics
        error_msg = []
        if missing:
            error_msg.append(f"Missing metrics: {', '.join(missing)}")
        if extra:
            error_msg.append(f"Unexpected metrics: {', '.join(extra)}")
        raise HTTPException(status_code=400, detail="; ".join(error_msg))

    # Get user info
    user_name = next(
        (m.get("name") for m in members if m.get("email") == data.email),
        data.email
    )

    # Get or create dashboard data document for current period
    dashboard_data_collection = get_collection("dashboard_data")

    current_period = get_current_week()
    week_start, week_end = get_week_range()

    # Find existing data document for this period
    data_doc = await dashboard_data_collection.find_one({
        "dashboard_id": dashboard_id,
        "reporting_period": current_period
    })

    now = datetime.utcnow()

    if not data_doc:
        # Create new data document
        metrics_data = {}
        for metric in template_metrics:
            metrics_data[metric] = {
                data.email: {
                    "name": user_name,
                    "value": data.metrics.get(metric),
                    "submitted_at": now
                }
            }

        new_data_doc = {
            "dashboard_id": dashboard_id,
            "dashboard_name": template.get("dashboard_name"),
            "team_id": template.get("team_id"),
            "team_name": template.get("team_name"),
            "reporting_period": current_period,
            "week_start": week_start,
            "week_end": week_end,
            "metrics_data": metrics_data,
            "created_at": now,
            "updated_at": now
        }

        await dashboard_data_collection.insert_one(new_data_doc)

    else:
        # Update existing document
        metrics_data = data_doc.get("metrics_data", {})

        for metric in template_metrics:
            if metric not in metrics_data:
                metrics_data[metric] = {}

            metrics_data[metric][data.email] = {
                "name": user_name,
                "value": data.metrics.get(metric),
                "submitted_at": now
            }

        await dashboard_data_collection.update_one(
            {
                "dashboard_id": dashboard_id,
                "reporting_period": current_period
            },
            {
                "$set": {
                    "metrics_data": metrics_data,
                    "updated_at": now
                }
            }
        )

    print(f"✅ Metrics submitted by {data.email} for {template.get('dashboard_name')}")

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "dashboard_name": template.get("dashboard_name"),
        "reporting_period": current_period,
        "submitted_by": data.email,
        "metrics_submitted": list(data.metrics.keys())
    }


@router.get("/{dashboard_id}/data")
async def get_dashboard_data(dashboard_id: str, period: Optional[str] = None):
    """
    Get dashboard data for a specific period.

    Args:
        dashboard_id (str): Dashboard ID
        period (Optional[str]): Reporting period (default: current week)

    Returns:
        dict: Dashboard data

    Raises:
        HTTPException: 404 if dashboard or data not found
    """
    # Get dashboard template
    dashboard_templates = get_collection("dashboard_templates")

    try:
        template = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not template:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Get data
    dashboard_data_collection = get_collection("dashboard_data")

    if not period:
        period = get_current_week()

    data_doc = await dashboard_data_collection.find_one({
        "dashboard_id": dashboard_id,
        "reporting_period": period
    })

    if not data_doc:
        # Return empty structure
        return {
            "success": True,
            "dashboard_id": dashboard_id,
            "dashboard_name": template.get("dashboard_name"),
            "team_name": template.get("team_name"),
            "reporting_period": period,
            "metrics": template.get("metrics"),
            "data": {metric: {} for metric in template.get("metrics", [])},
            "message": "No data submitted for this period yet"
        }

    # Convert ObjectId to string
    data_doc['_id'] = str(data_doc['_id'])
    if data_doc.get('week_start'):
        data_doc['week_start'] = data_doc['week_start'].isoformat()
    if data_doc.get('week_end'):
        data_doc['week_end'] = data_doc['week_end'].isoformat()
    if data_doc.get('created_at'):
        data_doc['created_at'] = data_doc['created_at'].isoformat()
    if data_doc.get('updated_at'):
        data_doc['updated_at'] = data_doc['updated_at'].isoformat()

    # Convert timestamps in metrics_data
    metrics_data = data_doc.get('metrics_data', {})
    for metric in metrics_data:
        for email in metrics_data[metric]:
            if metrics_data[metric][email].get('submitted_at'):
                metrics_data[metric][email]['submitted_at'] = metrics_data[metric][email]['submitted_at'].isoformat()

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "dashboard_name": data_doc.get("dashboard_name"),
        "team_name": data_doc.get("team_name"),
        "reporting_period": period,
        "week_start": data_doc.get('week_start'),
        "week_end": data_doc.get('week_end'),
        "metrics": template.get("metrics"),
        "data": metrics_data
    }


@router.get("/list")
async def list_dashboards(request: Request):
    """
    List all dashboards owned by the authenticated user.

    Args:
        request (Request): FastAPI request object

    Returns:
        dict: List of dashboards

    Raises:
        HTTPException: 401 if not authenticated
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")
    dashboards = await dashboard_templates.find({"owner_email": user_email}).to_list(length=1000)

    # Get URLs for each dashboard
    dashboard_logins = get_collection("dashboard_logins")

    for dashboard in dashboards:
        dashboard_id = str(dashboard['_id'])
        dashboard['_id'] = dashboard_id
        dashboard['created_at'] = dashboard['created_at'].isoformat() if dashboard.get('created_at') else None
        dashboard['updated_at'] = dashboard['updated_at'].isoformat() if dashboard.get('updated_at') else None

        # Get URL
        login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})
        dashboard['url'] = login_doc.get('url') if login_doc else None

    return {
        "success": True,
        "dashboards": dashboards,
        "count": len(dashboards)
    }


@router.get("/{dashboard_id}")
async def get_dashboard(request: Request, dashboard_id: str):
    """
    Get dashboard details.

    Args:
        request (Request): FastAPI request object
        dashboard_id (str): Dashboard ID

    Returns:
        dict: Dashboard details

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if dashboard not found
        HTTPException: 403 if user doesn't own the dashboard
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    dashboard['_id'] = str(dashboard['_id'])
    dashboard['created_at'] = dashboard['created_at'].isoformat() if dashboard.get('created_at') else None
    dashboard['updated_at'] = dashboard['updated_at'].isoformat() if dashboard.get('updated_at') else None

    # Get URL
    dashboard_logins = get_collection("dashboard_logins")
    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})
    dashboard['url'] = login_doc.get('url') if login_doc else None
    dashboard['members_with_access'] = len(login_doc.get('members', [])) if login_doc else 0

    return {
        "success": True,
        "dashboard": dashboard
    }


@router.put("/{dashboard_id}")
async def update_dashboard(request: Request, dashboard_id: str, data: UpdateDashboardRequest):
    """
    Update dashboard details.

    Args:
        request (Request): FastAPI request object
        dashboard_id (str): Dashboard ID
        data (UpdateDashboardRequest): Updated data

    Returns:
        dict: Update result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if dashboard not found
        HTTPException: 403 if user doesn't own the dashboard
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    # Build update document
    update_doc = {"updated_at": datetime.utcnow()}

    if data.dashboard_name is not None:
        update_doc["dashboard_name"] = data.dashboard_name

    if data.metrics is not None:
        update_doc["metrics"] = data.metrics

    if data.is_active is not None:
        update_doc["is_active"] = data.is_active

    result = await dashboard_templates.update_one(
        {"_id": ObjectId(dashboard_id)},
        {"$set": update_doc}
    )

    # Update dashboard_logins if name changed
    if data.dashboard_name is not None:
        dashboard_logins = get_collection("dashboard_logins")
        await dashboard_logins.update_one(
            {"dashboard_id": dashboard_id},
            {"$set": {"dashboard_name": data.dashboard_name, "updated_at": datetime.utcnow()}}
        )

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "modified_count": result.modified_count
    }


@router.delete("/{dashboard_id}")
async def delete_dashboard(request: Request, dashboard_id: str):
    """
    Delete a dashboard.

    Args:
        request (Request): FastAPI request object
        dashboard_id (str): Dashboard ID

    Returns:
        dict: Deletion result

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 404 if dashboard not found
        HTTPException: 403 if user doesn't own the dashboard
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    # Delete dashboard template
    result = await dashboard_templates.delete_one({"_id": ObjectId(dashboard_id)})

    # Delete login access
    dashboard_logins = get_collection("dashboard_logins")
    await dashboard_logins.delete_one({"dashboard_id": dashboard_id})

    # Optionally delete all data (or keep for historical purposes)
    # dashboard_data_collection = get_collection("dashboard_data")
    # await dashboard_data_collection.delete_many({"dashboard_id": dashboard_id})

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "dashboard_name": dashboard.get("dashboard_name"),
        "deleted_count": result.deleted_count
    }


@router.post("/{dashboard_id}/sync-members")
async def sync_dashboard_members(request: Request, dashboard_id: str):
    """
    Sync team members to dashboard - generates passcodes for new members.

    Call this after adding members to a team to update dashboard access.
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")
    dashboard_logins = get_collection("dashboard_logins")
    teams_collection = get_collection("teams")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    # Get team
    team_id = dashboard.get("team_id")
    try:
        team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Get current dashboard login doc
    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    if not login_doc:
        raise HTTPException(status_code=404, detail="Dashboard login config not found")

    # Get existing members (by email)
    existing_members = {m.get("email"): m for m in login_doc.get("members", [])}

    # Get team members
    team_members = team.get("members", [])

    # Build updated members list
    updated_members = []
    new_count = 0

    for member in team_members:
        email = member.get("email")
        if email in existing_members:
            # Keep existing member with their passcode
            updated_members.append(existing_members[email])
        else:
            # New member - generate passcode
            passcode = secrets.token_urlsafe(8)
            updated_members.append({
                "email": email,
                "name": member.get("name"),
                "slack_user_id": member.get("slack_user_id"),
                "passcode": passcode,
                "can_access": True
            })
            new_count += 1

    # Update dashboard logins
    await dashboard_logins.update_one(
        {"dashboard_id": dashboard_id},
        {
            "$set": {
                "members": updated_members,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "total_members": len(updated_members),
        "new_members_added": new_count,
        "member_passcodes": [
            {
                "name": m["name"],
                "email": m["email"],
                "passcode": m["passcode"]
            }
            for m in updated_members
        ]
    }


@router.get("/{dashboard_id}/login-info")
async def get_dashboard_login_info(request: Request, dashboard_id: str):
    """Get dashboard login info including member passcodes (owner only)."""
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    dashboard_templates = get_collection("dashboard_templates")
    dashboard_logins = get_collection("dashboard_logins")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this dashboard")

    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    if not login_doc:
        return {"success": True, "members": []}

    return {
        "success": True,
        "dashboard_id": dashboard_id,
        "members": login_doc.get("members", [])
    }