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