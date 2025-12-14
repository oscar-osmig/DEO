"""
Scan Checker for Scan Blocks

This module provides background task to check pending scans for commands
in Slack channels and execute subsequent blocks when found.
"""

from database import get_collection
from datetime import datetime
import asyncio
from .scan import check_channel_for_command


async def process_scan_trigger(scan: dict):
    """
    Process a triggered scan - execute remaining blocks.

    Args:
        scan: The scan document from database
    """
    from orchestra.orchestrate import TemplateOrchestrator

    template_id = scan.get("template_id")
    workspace_id = scan.get("workspace_id")
    bot_token = scan.get("bot_token")
    remaining_blocks = scan.get("remaining_blocks", [])
    action_chain = scan.get("action_chain", {})

    print(f"Executing remaining blocks for scan trigger: {template_id}")

    try:
        # Create orchestrator with remaining blocks
        modified_chain = action_chain.copy()
        modified_chain["blocks"] = remaining_blocks

        orchestrator = TemplateOrchestrator(
            modified_chain,
            bot_token,
            template_id=template_id,
            workspace_id=workspace_id
        )

        results = await orchestrator.execute()
        print(f"Scan trigger execution completed: {template_id}")

        # Log execution
        executions_log = get_collection("scan_executions_log")
        await executions_log.insert_one({
            "template_id": template_id,
            "workspace_id": workspace_id,
            "executed_at": datetime.utcnow(),
            "results": results,
            "status": "completed",
            "channel_name": scan.get("channel_name"),
            "command": scan.get("command")
        })

    except Exception as e:
        print(f"Scan trigger execution failed: {str(e)}")


async def check_scans():
    """Check all active scans for commands in their channels."""
    pending_scans = get_collection("pending_scans")

    now = datetime.utcnow()

    # Find scans that are due for checking
    scans_to_check = await pending_scans.find({
        "status": "scanning",
        "next_check_at": {"$lte": now}
    }).to_list(length=100)

    for scan in scans_to_check:
        scan_id = str(scan["_id"])
        template_id = scan.get("template_id")
        channel_id = scan.get("channel_id")
        channel_name = scan.get("channel_name")
        command = scan.get("command")
        bot_token = scan.get("bot_token")
        last_message_ts = scan.get("last_message_ts")
        interval_seconds = scan.get("interval_seconds", 30)

        try:
            # Check channel for command
            result = await check_channel_for_command(
                channel_id,
                command,
                bot_token,
                last_message_ts
            )

            # Update next check time and last checked
            next_check = datetime.utcnow()
            next_check = datetime.fromtimestamp(
                next_check.timestamp() + interval_seconds
            )

            update_data = {
                "last_checked_at": now,
                "next_check_at": next_check,
                "last_message_ts": result.get("latest_ts")
            }

            if result.get("found"):
                # Command found! Execute remaining blocks
                print(f"Command '{command}' found in #{channel_name}!")
                print(f"Message: {result.get('message')}")

                # Update trigger stats
                update_data["times_triggered"] = scan.get("times_triggered", 0) + 1
                update_data["last_triggered_at"] = now

                # Update scan first (so we don't re-process same message)
                await pending_scans.update_one(
                    {"_id": scan["_id"]},
                    {"$set": update_data}
                )

                # Execute remaining blocks
                await process_scan_trigger(scan)
            else:
                # Just update timing
                await pending_scans.update_one(
                    {"_id": scan["_id"]},
                    {"$set": update_data}
                )

        except Exception as e:
            print(f"Error checking scan {scan_id}: {str(e)}")

            # Still update next check time to avoid getting stuck
            next_check = datetime.fromtimestamp(
                datetime.utcnow().timestamp() + interval_seconds
            )
            await pending_scans.update_one(
                {"_id": scan["_id"]},
                {"$set": {"next_check_at": next_check, "last_error": str(e)}}
            )


async def scan_checker_loop():
    """
    Background loop that checks for scan commands every 5 seconds.

    This should be started as a background task when the app starts.
    """
    print("Scan checker loop started")
    while True:
        try:
            await check_scans()
        except Exception as e:
            print(f"Error in scan checker: {str(e)}")

        # Check every 5 seconds (scans have their own intervals)
        await asyncio.sleep(5)
