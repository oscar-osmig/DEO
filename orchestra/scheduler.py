"""
Template Scheduler Service

Manages scheduled execution of templates using APScheduler.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from datetime import datetime
from typing import Dict, Any

from apscheduler.triggers.interval import IntervalTrigger

from database import get_collection
import logging

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler = None


def get_scheduler():
    """Get the global scheduler instance."""
    return scheduler


async def initialize_scheduler():
    """Initialize the APScheduler instance."""
    global scheduler
    scheduler = AsyncIOScheduler()
    scheduler.start()
    logger.info("Scheduler started")
    print("📅 Scheduler started")


async def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
        print("📅 Scheduler stopped")


async def execute_scheduled_template(template_id: str, workspace_id: str):
    """
    Execute a template as part of scheduled job.

    Args:
        template_id: Template to execute
        workspace_id: Workspace ID
    """
    from orchestra.orchestrate import TemplateOrchestrator

    print(f"\n⏰ Executing scheduled template: {template_id}")

    try:
        # Get template and workspace
        templates_collection = get_collection("templates")
        workspaces_collection = get_collection("workspaces")

        template = await templates_collection.find_one({"template_id": template_id})
        workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

        if not template or not workspace:
            print(f"❌ Template or workspace not found")
            return

        bot_token = workspace.get("bot_token")
        action_chain = template.get("action_chain")

        # Execute template
        orchestrator = TemplateOrchestrator(
            action_chain,
            bot_token,
            template_id=template_id,
            workspace_id=workspace_id
        )

        results = await orchestrator.execute()
        print(f"✅ Scheduled execution completed: {template_id}")

        # Log execution
        executions_log = get_collection("scheduled_executions_log")
        await executions_log.insert_one({
            "template_id": template_id,
            "workspace_id": workspace_id,
            "executed_at": datetime.utcnow(),
            "results": results,
            "status": "completed"
        })

    except Exception as e:
        print(f"❌ Scheduled execution failed: {str(e)}")
        logger.error(f"Scheduled execution failed: {str(e)}")


def parse_schedule_config(schedule_config: Dict[str, Any]):
    """
    Parse schedule configuration into APScheduler trigger.

    Args:
        schedule_config: Dict with schedule details
            - regularity: "daily", "weekly", "monthly", "once", "interval"
            - time: "HH:MM" (24-hour format) - REQUIRED for daily/weekly/monthly
            - day_of_week: 0-6 (Monday=0) - REQUIRED for weekly
            - day_of_month: 1-31 - REQUIRED for monthly
            - date: ISO date string - REQUIRED for once
            - interval_minutes: Number of minutes - REQUIRED for interval

    Returns:
        CronTrigger, DateTrigger, or IntervalTrigger instance
    """
    regularity = schedule_config.get("regularity")

    if regularity == "interval":
        # Run every X minutes
        minutes = schedule_config.get("interval_minutes")
        if minutes is None:
            raise ValueError("interval_minutes is required for interval regularity")
        return IntervalTrigger(minutes=minutes)

    elif regularity == "once":
        # Run once at specific datetime
        date_str = schedule_config.get("date")
        if not date_str:
            raise ValueError("date is required for once regularity")
        run_date = datetime.fromisoformat(date_str)
        return DateTrigger(run_date=run_date)

    # For daily, weekly, monthly - parse time
    time_str = schedule_config.get("time")
    if not time_str:
        raise ValueError(f"time is required for {regularity} regularity")

    hour, minute = map(int, time_str.split(":"))

    if regularity == "daily":
        # Run every day at specified time
        return CronTrigger(hour=hour, minute=minute)

    elif regularity == "weekly":
        # Run every week on specific day
        day_of_week = schedule_config.get("day_of_week")
        if day_of_week is None:
            raise ValueError("day_of_week is required for weekly regularity")
        return CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute)

    elif regularity == "monthly":
        # Run every month on specific day
        day_of_month = schedule_config.get("day_of_month")
        if day_of_month is None:
            raise ValueError("day_of_month is required for monthly regularity")
        return CronTrigger(day=day_of_month, hour=hour, minute=minute)

    else:
        raise ValueError(f"Invalid regularity: {regularity}. Must be one of: daily, weekly, monthly, once, interval")


async def schedule_template(template_id: str, workspace_id: str, schedule_config: Dict[str, Any]) -> str:
    """
    Schedule a template for execution.

    Args:
        template_id: Template to schedule
        workspace_id: Workspace ID
        schedule_config: Schedule configuration

    Returns:
        job_id: APScheduler job ID
    """
    global scheduler

    # Parse schedule configuration
    trigger = parse_schedule_config(schedule_config)

    # Create unique job ID
    job_id = f"{template_id}_{workspace_id}"

    # Add job to scheduler
    scheduler.add_job(
        execute_scheduled_template,
        trigger=trigger,
        args=[template_id, workspace_id],
        id=job_id,
        replace_existing=True
    )

    # Store in database
    schedules_collection = get_collection("active_schedules")
    await schedules_collection.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "template_id": template_id,
                "workspace_id": workspace_id,
                "schedule_config": schedule_config,
                "created_at": datetime.utcnow(),
                "status": "active"
            }
        },
        upsert=True
    )

    print(f"📅 Scheduled template {template_id}: {schedule_config.get('regularity')}")
    return job_id


async def unschedule_template(job_id: str):
    """
    Remove a scheduled template.

    Args:
        job_id: APScheduler job ID
    """
    global scheduler

    # Remove from scheduler
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    # Update database
    schedules_collection = get_collection("active_schedules")
    await schedules_collection.update_one(
        {"job_id": job_id},
        {"$set": {"status": "stopped", "stopped_at": datetime.utcnow()}}
    )

    print(f"🛑 Unscheduled job: {job_id}")


async def load_active_schedules():
    """
    Load and restore active schedules from database on startup.
    """
    schedules_collection = get_collection("active_schedules")
    active = await schedules_collection.find({"status": "active"}).to_list(length=1000)

    for schedule in active:
        try:
            await schedule_template(
                schedule["template_id"],
                schedule["workspace_id"],
                schedule["schedule_config"]
            )
        except Exception as e:
            print(f"❌ Failed to restore schedule {schedule['job_id']}: {str(e)}")

    print(f"📅 Restored {len(active)} active schedule(s)")
