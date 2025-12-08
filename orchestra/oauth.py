"""
OAuth Authentication Module
"""

import os
from dotenv import load_dotenv
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from database import get_collection
from datetime import datetime
import secrets
import httpx

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

# Jinja2 templates
templates = Jinja2Templates(directory="static")

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Dynamic URLs based on environment
# If ENVIRONMENT is not set or is "production", use production URLs
IS_DEVELOPMENT = os.getenv("ENVIRONMENT") == "development"

if IS_DEVELOPMENT:
    REDIRECT_URI = "http://127.0.0.1:8000/auth/callback"
    APP_URL = "http://127.0.0.1:8000"
else:
    REDIRECT_URI = "https://godeo.app/auth/callback"
    APP_URL = "https://godeo.app"

@router.get("/login")
async def login(request: Request):
    """Redirect to Google OAuth"""
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&prompt=select_account"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/callback")
async def auth_callback(request: Request):
    """Handle Google OAuth callback"""
    code = request.query_params.get('code')

    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": REDIRECT_URI,
                }
            )

            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get token")

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if user_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")

            user_info = user_response.json()

        accounts_collection = get_collection("accounts")
        sessions_collection = get_collection("active_sessions")

        account_doc = {
            "username": user_info.get('name'),
            "gmail": user_info.get('email'),
            "google_id": user_info.get('id'),
            "picture": user_info.get('picture'),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        await accounts_collection.update_one(
            {"gmail": user_info.get('email')},
            {"$set": account_doc},
            upsert=True
        )

        request.session['user_email'] = user_info.get('email')
        session_id = secrets.token_urlsafe(32)
        request.session['_id'] = session_id

        session_doc = {
            "username": user_info.get('name'),
            "gmail": user_info.get('email'),
            "session_cookie": session_id,
            "logged_in_at": datetime.utcnow(),
            "last_active": datetime.utcnow()
        }

        await sessions_collection.update_one(
            {"gmail": user_info.get('email')},
            {"$set": session_doc},
            upsert=True
        )

        print(f"✅ Session stored for {user_info.get('name')}")

        return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="refresh" content="0;url={APP_URL}/app">
            </head>
            <body>
                <script>window.location.replace('{APP_URL}/app');</script>
            </body>
            </html>
        """)

    except Exception as e:
        print(f"❌ Callback error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_current_user(request: Request):
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    accounts_collection = get_collection("accounts")
    sessions_collection = get_collection("active_sessions")

    account = await accounts_collection.find_one({"gmail": user_email})

    if not account:
        raise HTTPException(status_code=404, detail="User not found")

    await sessions_collection.update_one(
        {"gmail": user_email},
        {"$set": {"last_active": datetime.utcnow()}}
    )

    workspaces_collection = get_collection("workspaces")
    workspace = await workspaces_collection.find_one({"gmail": user_email})

    return {
        "username": account.get("username"),
        "email": account.get("gmail"),
        "picture": account.get("picture"),
        "has_workspace": workspace is not None,
        "workspace_id": workspace.get("workspace_id") if workspace else None,
        "workspace_name": workspace.get("workspace_name") if workspace else None,
        "bot_token": workspace.get("bot_token") if workspace else None
    }


@router.post("/update-token")
async def update_slack_token(request: Request):
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    bot_token = body.get("bot_token")

    if not bot_token:
        raise HTTPException(status_code=400, detail="Bot token is required")

    workspaces_collection = get_collection("workspaces")
    accounts_collection = get_collection("accounts")
    sessions_collection = get_collection("active_sessions")

    account = await accounts_collection.find_one({"gmail": user_email})

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    await sessions_collection.update_one(
        {"gmail": user_email},
        {"$set": {"last_active": datetime.utcnow()}}
    )

    workspace_doc = {
        "username": account["username"],
        "account_id": str(account["_id"]),
        "gmail": user_email,
        "bot_token": bot_token,
        "workspace_name": f"{account['username']}'s Workspace",
        "workspace_id": f"workspace-{account['_id']}",
        "updated_at": datetime.utcnow()
    }

    await workspaces_collection.update_one(
        {"gmail": user_email},
        {"$set": workspace_doc},
        upsert=True
    )

    return {
        "success": True,
        "message": "Slack token updated successfully"
    }


@router.get("/logout")
async def logout(request: Request):
    user_email = request.session.get('user_email')

    if user_email:
        sessions_collection = get_collection("active_sessions")
        await sessions_collection.delete_one({"gmail": user_email})
        print(f"✅ Session deleted for {user_email}")

    request.session.clear()
    return RedirectResponse(url=f"{APP_URL}/login")


@router.get("/sessions/active")
async def get_active_sessions(request: Request):
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sessions_collection = get_collection("active_sessions")
    active_sessions = await sessions_collection.find().to_list(length=1000)

    for session in active_sessions:
        session['_id'] = str(session['_id'])

    return {
        "success": True,
        "active_sessions": active_sessions,
        "count": len(active_sessions)
    }


@router.get("/sessions/me")
async def get_my_session(request: Request):
    user_email = request.session.get('user_email')

    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sessions_collection = get_collection("active_sessions")
    session = await sessions_collection.find_one({"gmail": user_email})

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session['_id'] = str(session['_id'])

    return {
        "success": True,
        "session": session
    }


@router.post("/sessions/get-by-email")
async def get_session_by_email(request: Request):
    body = await request.json()
    email = body.get("email")
    secret_code = body.get("secret_code")

    HARDCODED_SECRET = "DEO-SECRET-2025"

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if not secret_code:
        raise HTTPException(status_code=400, detail="Secret code is required")

    if secret_code != HARDCODED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret code")

    sessions_collection = get_collection("active_sessions")
    session = await sessions_collection.find_one({"gmail": email})

    if not session:
        raise HTTPException(status_code=404, detail="No active session found")

    return {
        "success": True,
        "email": email,
        "username": session.get("username"),
        "session_cookie": session.get("session_cookie"),
        "logged_in_at": session.get("logged_in_at").isoformat() if session.get("logged_in_at") else None,
        "last_active": session.get("last_active").isoformat() if session.get("last_active") else None
    }