"""
Timeout Checker for Await Blocks

This module provides background task to check for timed-out await executions
and handle them appropriately.
"""

import httpx
from database import get_collection
from datetime import datetime
import asyncio


async def send_failure_message(channel: str, message: str, bot_token: str):
    """Send failure message to Slack channel."""
    url = "https://slack.com/api/chat.postMessage"

    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "channel": channel,
        "text": message
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response_data = response.json()

            if response_data.get("ok"):
                print(f"✅ Failure message sent to {channel}")
            else:
                print(f"❌ Failed to send failure message: {response_data.get('error')}")
    except Exception as e:
        print(f"❌ Error sending failure message: {str(e)}")


async def check_timeouts():
    """Check for timed-out awaits and handle them."""
    pending_executions = get_collection("pending_executions")
    failed_executions = get_collection("failed_executions")

    now = datetime.utcnow()
    timed_out = await pending_executions.find({
        "status": "awaiting_response",
        "timeout_at": {"$lt": now}
    }).to_list(length=100)

    for execution in timed_out:
        template_id = execution.get("template_id")
        failure_message = execution.get("failure_message")
        monitored_channels = execution.get("monitored_channels", [])
        monitored_users = execution.get("monitored_users", [])
        users_responded = execution.get("users_responded", [])
        bot_token = execution.get("bot_token")
        mode = execution.get("mode", "users")

        print(f"⏰ Timeout for template: {template_id} (mode: {mode})")

        # Send failure message
        if failure_message and bot_token:
            if mode == "channel":
                # Send to channel (everyone sees it)
                if monitored_channels:
                    await send_failure_message(monitored_channels[0], failure_message, bot_token)
            else:
                # Users mode: send only to users who DIDN'T respond
                users_not_responded = set(monitored_users) - set(users_responded)
                print(f"   Sending failure message to {len(users_not_responded)} user(s) who didn't respond")

                # Get DM channel for each non-responder
                for i, user_id in enumerate(users_not_responded):
                    channel_id = monitored_channels[i] if i < len(monitored_channels) else None
                    if channel_id:
                        await send_failure_message(channel_id, failure_message, bot_token)
                        print(f"   Sent to user {user_id}")

        # Update and move to failed
        execution["status"] = "failed"
        execution["completed_at"] = datetime.utcnow()
        execution["failure_reason"] = "timeout"

        # Track who didn't respond
        execution["users_not_responded"] = list(set(monitored_users) - set(users_responded))

        await failed_executions.insert_one(execution)
        await pending_executions.delete_one({"_id": execution["_id"]})

        print(f"📦 Moved to failed_executions")


async def timeout_checker_loop():
    """
    Background loop that checks for timeouts every 30 seconds.

    This should be started as a background task when the app starts.
    """
    while True:
        try:
            await check_timeouts()
        except Exception as e:
            print(f"❌ Error in timeout checker: {str(e)}")

        # Wait 30 seconds before next check
        await asyncio.sleep(30)