"""
Main Application Entry Point
"""
import os
from dotenv import load_dotenv

load_dotenv()

from orchestra import account_router, workspace_router, oauth_router, templates_router, teams_router, dashboards_router, applications_router

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from starlette.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from database import connect_to_mongo, close_mongo_connection
from endpoints import router
from orchestra.blocks.timeout_checker import timeout_checker_loop
from orchestra.blocks.scan_checker import scan_checker_loop
from orchestra.scheduler import initialize_scheduler, shutdown_scheduler, load_active_schedules

import asyncio

templates = Jinja2Templates(directory="static")

# Check if running in production
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"


# Custom StaticFiles that disables caching in development
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if not IS_PRODUCTION:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    connected = await connect_to_mongo()
    timeout_task = None
    scan_task = None

    if connected:
        await initialize_scheduler()
        await load_active_schedules()
        print("Scheduler started")

        timeout_task = asyncio.create_task(timeout_checker_loop())
        print("Timeout checker started")

        scan_task = asyncio.create_task(scan_checker_loop())
        print("Scan checker started")
    else:
        print("Skipping scheduler and checkers - database not connected")

    yield

    # Shutdown
    if timeout_task:
        timeout_task.cancel()
    if scan_task:
        scan_task.cancel()
    if connected:
        await shutdown_scheduler()
    await close_mongo_connection()


app = FastAPI(lifespan=lifespan)

# Session middleware - adapts to environment
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    max_age=60 * 60 * 24 * 14,  # 14 days
    same_site="lax",
    https_only=IS_PRODUCTION  # True for production (HTTPS), False for local (HTTP)
)


@app.get("/login")
async def serve_login():
    return FileResponse("static/login.html")


@app.get("/app")
async def serve_app(request: Request):
    return templates.TemplateResponse("app.html", {"request": request})


@app.get("/team-dashboard/{dashboard_id}", response_class=HTMLResponse)
async def team_dashboard_page(request: Request, dashboard_id: str):
    """Serve the team dashboard login/metrics page."""
    from database import get_collection
    from bson import ObjectId

    # Get dashboard info (public, no auth required)
    dashboard_templates_collection = get_collection("dashboard_templates")
    dashboard_logins = get_collection("dashboard_logins")

    try:
        dashboard = await dashboard_templates_collection.find_one({"_id": ObjectId(dashboard_id)})
    except:
        return templates.TemplateResponse("templates/error.html", {
            "request": request,
            "error": "Invalid dashboard ID"
        })

    if not dashboard:
        return templates.TemplateResponse("templates/error.html", {
            "request": request,
            "error": "Dashboard not found"
        })

    login_doc = await dashboard_logins.find_one({"dashboard_id": dashboard_id})

    return templates.TemplateResponse("templates/team-dashboard.html", {
        "request": request,
        "dashboard_id": dashboard_id,
        "dashboard_name": dashboard.get("dashboard_name", "Dashboard"),
        "team_name": dashboard.get("team_name", "Team"),
        "metrics": dashboard.get("metrics", []),
        "reporting_period": dashboard.get("reporting_period", "weekly")
    })


@app.get("/application/{form_id}", response_class=HTMLResponse)
async def application_page(request: Request, form_id: str):
    """Serve the public job application form page."""
    from database import get_collection
    from bson import ObjectId

    applications_collection = get_collection("application_forms")

    try:
        form = await applications_collection.find_one({"_id": ObjectId(form_id)})
    except:
        return templates.TemplateResponse("templates/error.html", {
            "request": request,
            "error": "Invalid application form ID"
        })

    if not form:
        return templates.TemplateResponse("templates/error.html", {
            "request": request,
            "error": "Application form not found"
        })

    if not form.get("is_active"):
        return templates.TemplateResponse("templates/error.html", {
            "request": request,
            "error": "This application form is no longer accepting applications"
        })

    return templates.TemplateResponse("templates/application.html", {
        "request": request,
        "form_id": form_id,
        "position_title": form.get("position_title", "Position"),
        "company_name": form.get("company_name", "Company"),
        "team_name": form.get("team_name", "Team")
    })


app.include_router(account_router)
app.include_router(workspace_router)
app.include_router(oauth_router)
app.include_router(templates_router)
app.include_router(teams_router)
app.include_router(dashboards_router)
app.include_router(applications_router)

# Use NoCacheStaticFiles in development, regular StaticFiles in production
app.mount("/static", NoCacheStaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)