"""
Main Application Entry Point
"""
import os
from dotenv import load_dotenv

load_dotenv()

from orchestra import account_router, workspace_router, oauth_router, templates_router, teams_router, dashboards_router

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from starlette.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from database import connect_to_mongo, close_mongo_connection
from endpoints import router
from orchestra.blocks.timeout_checker import timeout_checker_loop
from orchestra.scheduler import initialize_scheduler, shutdown_scheduler, load_active_schedules

import asyncio

templates = Jinja2Templates(directory="static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await initialize_scheduler()
    await load_active_schedules()
    timeout_task = asyncio.create_task(timeout_checker_loop())
    print("🕐 Timeout checker started")

    yield

    timeout_task.cancel()
    await shutdown_scheduler()
    await close_mongo_connection()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    max_age=None,
    same_site="lax",
    https_only=False
)


@app.get("/login")
async def serve_login():
    return FileResponse("static/login.html")


@app.get("/app")
async def serve_app(request: Request):
    return templates.TemplateResponse("app.html", {"request": request})

from fastapi.responses import HTMLResponse

@app.get("/team-dashboard/{dashboard_id}", response_class=HTMLResponse)
async def team_dashboard_page(request: Request, dashboard_id: str):
    """Serve the team dashboard login/metrics page."""
    from database import get_collection
    from bson import ObjectId

    # Get dashboard info (public, no auth required)
    dashboard_templates = get_collection("dashboard_templates")
    dashboard_logins = get_collection("dashboard_logins")

    try:
        dashboard = await dashboard_templates.find_one({"_id": ObjectId(dashboard_id)})
    except:
        return templates.TemplateResponse("error.html", {
            "request": request,
            "error": "Invalid dashboard ID"
        })

    if not dashboard:
        return templates.TemplateResponse("error.html", {
            "request": request,
            "error": "Dashboard not found"
        })

    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    return templates.TemplateResponse("team-dashboard.html", {
        "request": request,
        "dashboard_id": dashboard_id,
        "dashboard_name": dashboard.get("dashboard_name", "Dashboard"),
        "team_name": dashboard.get("team_name", "Team"),
        "metrics": dashboard.get("metrics", []),
        "reporting_period": dashboard.get("reporting_period", "weekly")
    })

app.include_router(account_router)
app.include_router(workspace_router)
app.include_router(oauth_router)
app.include_router(templates_router)
app.include_router(teams_router)
app.include_router(dashboards_router)

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)