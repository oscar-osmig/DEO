"""
Job Applications Module

This module handles job application creation, submission, and sending to Slack.
Teams can create application forms to receive job applications from candidates.
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from database import get_collection
from datetime import datetime
from bson import ObjectId
import secrets
import httpx
import os
import json

router = APIRouter(prefix="/applications", tags=["applications"])


class CreateApplicationFormRequest(BaseModel):
    """
    Request model for creating an application form.

    Attributes:
        team_id (str): ID of the team creating this form
        position_title (str): Job position title
        company_name (str): Company name to display on form
        workspace_id (str): Workspace ID for Slack integration
        send_to_type (str): "user" or "channel"
        send_to_id (str): Slack user ID or channel ID to send applications to
        base_url (str): Base URL for generating form link
        publish_on_deo_jobs (bool): Whether to publish on public DEO Jobs board
    """
    team_id: str
    position_title: str
    company_name: str
    workspace_id: str
    send_to_type: str  # "user" or "channel"
    send_to_id: str
    base_url: str
    publish_on_deo_jobs: bool = False


@router.post("/create")
async def create_application_form(request: Request, data: CreateApplicationFormRequest):
    """
    Create a new job application form.

    This endpoint:
    1. Creates an application form template
    2. Generates a unique public URL
    3. Returns the URL to share with candidates

    Returns:
        dict: Created form with URL
    """
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

    # Verify workspace exists and get bot token
    workspaces_collection = get_collection("workspaces")
    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(data.workspace_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Create application form
    applications_collection = get_collection("application_forms")

    form_doc = {
        "team_id": data.team_id,
        "team_name": team.get("team_name"),
        "company_name": data.company_name,
        "position_title": data.position_title,
        "workspace_id": data.workspace_id,
        "workspace_name": workspace.get("workspace_name"),
        "send_to_type": data.send_to_type,
        "send_to_id": data.send_to_id,
        "owner_email": user_email,
        "owner_name": account.get("username"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True,
        "application_count": 0,
        "publish_on_deo_jobs": data.publish_on_deo_jobs
    }

    result = await applications_collection.insert_one(form_doc)
    form_id = str(result.inserted_id)

    # Generate URL
    full_url = f"{data.base_url}/application/{form_id}"
    url_path = f"/application/{form_id}"

    # Update with URL
    await applications_collection.update_one(
        {"_id": result.inserted_id},
        {"$set": {"url": full_url, "url_path": url_path}}
    )

    # If publishing on DEO Jobs, add to public jobs collection
    if data.publish_on_deo_jobs:
        deo_jobs_collection = get_collection("deo_jobs")
        job_doc = {
            "form_id": form_id,
            "position_title": data.position_title,
            "company_name": data.company_name,
            "team_name": team.get("team_name"),
            "application_url": full_url,
            "owner_email": user_email,
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        await deo_jobs_collection.insert_one(job_doc)
        print(f"📢 Job published on DEO Jobs: {data.position_title} at {data.company_name}")

    print(f"✅ Application form created: {data.position_title}")
    print(f"   URL: {full_url}")
    print(f"   Team: {team.get('team_name')}")
    print(f"   Send to: {data.send_to_type} - {data.send_to_id}")
    print(f"   Published on DEO Jobs: {data.publish_on_deo_jobs}")

    return {
        "success": True,
        "form_id": form_id,
        "position_title": data.position_title,
        "url": full_url,
        "team_name": team.get("team_name")
    }


@router.get("/{form_id}/info")
async def get_application_form_info(form_id: str):
    """
    Get public info about an application form (no auth required).
    Used by the public application page.
    """
    applications_collection = get_collection("application_forms")

    try:
        form = await applications_collection.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")

    if not form:
        raise HTTPException(status_code=404, detail="Application form not found")

    if not form.get("is_active"):
        raise HTTPException(status_code=400, detail="This application form is no longer accepting applications")

    return {
        "success": True,
        "position_title": form.get("position_title"),
        "team_name": form.get("team_name"),
        "is_active": form.get("is_active")
    }


@router.post("/{form_id}/submit")
async def submit_application(
    form_id: str,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    linkedin: str = Form(None),
    portfolio: str = Form(None),
    cover_letter: str = Form(None),
    resume: UploadFile = File(...)
):
    """
    Submit a job application with resume.

    This endpoint:
    1. Validates the application form exists and is active
    2. Saves the application data
    3. Uploads resume to Slack and sends notification

    Returns:
        dict: Submission confirmation
    """
    applications_collection = get_collection("application_forms")
    submissions_collection = get_collection("application_submissions")
    workspaces_collection = get_collection("workspaces")

    try:
        form = await applications_collection.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")

    if not form:
        raise HTTPException(status_code=404, detail="Application form not found")

    if not form.get("is_active"):
        raise HTTPException(status_code=400, detail="This application form is no longer accepting applications")

    # Get workspace for bot token
    workspace_id = form.get("workspace_id")
    try:
        workspace = await workspaces_collection.find_one({"_id": ObjectId(workspace_id)})
    except:
        raise HTTPException(status_code=500, detail="Workspace configuration error")

    if not workspace:
        raise HTTPException(status_code=500, detail="Workspace not found")

    bot_token = workspace.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=500, detail="Workspace bot token not configured")

    # Read resume file
    resume_content = await resume.read()
    resume_filename = resume.filename

    # Save submission to database
    submission_doc = {
        "form_id": form_id,
        "position_title": form.get("position_title"),
        "team_id": form.get("team_id"),
        "team_name": form.get("team_name"),
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "portfolio": portfolio,
        "cover_letter": cover_letter,
        "resume_filename": resume_filename,
        "submitted_at": datetime.utcnow(),
        "status": "new"
    }

    result = await submissions_collection.insert_one(submission_doc)
    submission_id = str(result.inserted_id)

    # Increment application count
    await applications_collection.update_one(
        {"_id": ObjectId(form_id)},
        {"$inc": {"application_count": 1}}
    )

    # Send to Slack
    send_to_type = form.get("send_to_type")
    send_to_id = form.get("send_to_id")

    try:
        await send_application_to_slack(
            bot_token=bot_token,
            send_to_type=send_to_type,
            send_to_id=send_to_id,
            position_title=form.get("position_title"),
            team_name=form.get("team_name"),
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin=linkedin,
            portfolio=portfolio,
            cover_letter=cover_letter,
            resume_content=resume_content,
            resume_filename=resume_filename
        )
    except Exception as e:
        print(f"❌ Failed to send to Slack: {str(e)}")
        # Don't fail the submission, just log the error

    print(f"✅ Application submitted: {full_name} for {form.get('position_title')}")

    return {
        "success": True,
        "message": "Application submitted successfully",
        "submission_id": submission_id
    }


async def send_application_to_slack(
    bot_token: str,
    send_to_type: str,
    send_to_id: str,
    position_title: str,
    team_name: str,
    full_name: str,
    email: str,
    phone: str,
    linkedin: Optional[str],
    portfolio: Optional[str],
    cover_letter: Optional[str],
    resume_content: bytes,
    resume_filename: str
):
    """
    Send application notification and resume to Slack.
    """
    # Build message blocks
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📋 New Application: {position_title}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Team:*\n{team_name}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Position:*\n{position_title}"
                }
            ]
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*👤 Candidate Information*"
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Name:*\n{full_name}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Email:*\n{email}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Phone:*\n{phone}"
                }
            ]
        }
    ]

    # Add optional fields
    optional_fields = []
    if linkedin:
        optional_fields.append({
            "type": "mrkdwn",
            "text": f"*LinkedIn:*\n<{linkedin}|View Profile>"
        })
    if portfolio:
        optional_fields.append({
            "type": "mrkdwn",
            "text": f"*Portfolio:*\n<{portfolio}|View Portfolio>"
        })

    if optional_fields:
        blocks.append({
            "type": "section",
            "fields": optional_fields
        })

    # Add cover letter if provided
    if cover_letter:
        blocks.append({
            "type": "divider"
        })
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*📝 Cover Letter:*\n{cover_letter[:2000]}{'...' if len(cover_letter) > 2000 else ''}"
            }
        })

    blocks.append({
        "type": "divider"
    })
    blocks.append({
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": f"📎 Resume attached below • Submitted via Deo"
            }
        ]
    })

    # Determine channel for message
    async with httpx.AsyncClient(timeout=30.0) as client:
        if send_to_type == "user":
            # For DM, we need to open a conversation first
            dm_response = await client.post(
                "https://slack.com/api/conversations.open",
                headers={"Authorization": f"Bearer {bot_token}"},
                json={"users": send_to_id}
            )
            dm_data = dm_response.json()

            if not dm_data.get("ok"):
                raise Exception(f"Failed to open DM: {dm_data.get('error')}")

            channel_id = dm_data["channel"]["id"]
        else:
            channel_id = send_to_id
            # Try to join the channel first (bot needs to be a member to share files)
            join_response = await client.post(
                "https://slack.com/api/conversations.join",
                headers={"Authorization": f"Bearer {bot_token}"},
                json={"channel": channel_id}
            )
            join_data = join_response.json()
            if join_data.get("ok"):
                print(f"✅ Bot joined channel {channel_id}")
            elif join_data.get("error") == "already_in_channel":
                print(f"ℹ️ Bot already in channel {channel_id}")
            else:
                print(f"⚠️ Could not join channel: {join_data.get('error')}")

        # Send message with blocks
        msg_response = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {bot_token}"},
            json={
                "channel": channel_id,
                "text": f"New application for {position_title} from {full_name}",
                "blocks": blocks
            }
        )
        msg_data = msg_response.json()

        if not msg_data.get("ok"):
            print(f"⚠️ Message send warning: {msg_data.get('error')}")

        # Upload resume file using the new Slack file upload API
        # Step 1: Get upload URL
        file_size = len(resume_content)

        get_url_response = await client.post(
            "https://slack.com/api/files.getUploadURLExternal",
            headers={
                "Authorization": f"Bearer {bot_token}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={
                "filename": resume_filename,
                "length": file_size
            }
        )
        get_url_data = get_url_response.json()

        print(f"📤 Get upload URL response: {get_url_data}")

        if not get_url_data.get("ok"):
            print(f"⚠️ Failed to get upload URL: {get_url_data.get('error')}")
            return

        upload_url = get_url_data.get("upload_url")
        file_id = get_url_data.get("file_id")

        # Step 2: Upload the file content to the provided URL
        content_type = "application/octet-stream"
        if resume_filename.lower().endswith('.pdf'):
            content_type = "application/pdf"
        elif resume_filename.lower().endswith('.doc'):
            content_type = "application/msword"
        elif resume_filename.lower().endswith('.docx'):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        upload_response = await client.post(
            upload_url,
            content=resume_content,
            headers={"Content-Type": content_type}
        )

        print(f"📤 File upload status: {upload_response.status_code}")

        if upload_response.status_code != 200:
            print(f"⚠️ File upload failed with status: {upload_response.status_code}")
            return

        # Step 3: Complete the upload and share to channel
        # Note: files.completeUploadExternal expects form data, not JSON
        # The files parameter must be a JSON string
        files_param = json.dumps([{"id": file_id, "title": f"Resume - {full_name}"}])

        complete_response = await client.post(
            "https://slack.com/api/files.completeUploadExternal",
            headers={
                "Authorization": f"Bearer {bot_token}",
            },
            data={
                "files": files_param,
                "channel_id": channel_id,
                "initial_comment": f"📄 Resume for {full_name}'s application"
            }
        )
        complete_data = complete_response.json()

        print(f"📤 Complete upload response: {complete_data}")

        if not complete_data.get("ok"):
            print(f"⚠️ Failed to complete upload: {complete_data.get('error')}")
        else:
            print(f"✅ File uploaded successfully: {resume_filename}")


@router.get("/list")
async def list_application_forms(request: Request):
    """
    List all application forms owned by the authenticated user.
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    applications_collection = get_collection("application_forms")
    forms = await applications_collection.find({"owner_email": user_email}).to_list(length=1000)

    for form in forms:
        form['_id'] = str(form['_id'])
        form['created_at'] = form['created_at'].isoformat() if form.get('created_at') else None
        form['updated_at'] = form['updated_at'].isoformat() if form.get('updated_at') else None

    return {
        "success": True,
        "forms": forms,
        "count": len(forms)
    }


@router.get("/team/{team_id}")
async def list_team_application_forms(request: Request, team_id: str):
    """
    List all application forms for a specific team.
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    applications_collection = get_collection("application_forms")
    forms = await applications_collection.find({
        "team_id": team_id,
        "owner_email": user_email
    }).to_list(length=100)

    for form in forms:
        form['_id'] = str(form['_id'])
        form['created_at'] = form['created_at'].isoformat() if form.get('created_at') else None

    return {
        "success": True,
        "forms": forms
    }


@router.delete("/{form_id}")
async def delete_application_form(request: Request, form_id: str):
    """
    Delete an application form.
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    applications_collection = get_collection("application_forms")

    try:
        form = await applications_collection.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")

    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this form")

    await applications_collection.delete_one({"_id": ObjectId(form_id)})

    return {
        "success": True,
        "form_id": form_id
    }


@router.put("/{form_id}/toggle")
async def toggle_application_form(request: Request, form_id: str):
    """
    Toggle application form active status.
    """
    user_email = request.session.get('user_email')
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    applications_collection = get_collection("application_forms")

    try:
        form = await applications_collection.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")

    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="You don't own this form")

    new_status = not form.get("is_active", True)

    await applications_collection.update_one(
        {"_id": ObjectId(form_id)},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
    )

    return {
        "success": True,
        "form_id": form_id,
        "is_active": new_status
    }


@router.get("/deo-jobs/public")
async def get_public_deo_jobs():
    """
    Get all active public job listings for DEO Jobs page.
    No authentication required - this is a public endpoint.
    """
    deo_jobs_collection = get_collection("deo_jobs")

    jobs = await deo_jobs_collection.find({"is_active": True}).sort("created_at", -1).to_list(length=100)

    for job in jobs:
        job['_id'] = str(job['_id'])
        job['created_at'] = job['created_at'].isoformat() if job.get('created_at') else None

    return {
        "success": True,
        "jobs": jobs,
        "count": len(jobs)
    }
