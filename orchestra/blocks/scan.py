"""
Scan Block Executor

This module handles the execution of scan blocks in the orchestration system.
It monitors a Slack channel for a specific command continuously. Every time the
command is detected, it triggers the remaining blocks, then continues scanning.
Runs indefinitely until manually stopped.
"""

import httpx
from typing import Dict, Any, List
from database import get_collection
from datetime import datetime, timedelta
import re


def parse_interval(interval_str: str) -> timedelta:
    """
    Parse interval string like '10m', '1h', '30s' into timedelta.

    Args:
        interval_str (str): Interval string (e.g., "10m", "1h", "30s")

    Returns:
        timedelta: Parsed interval duration
    """
    match = re.match(r'^(\d+)([smh])$', interval_str.lower())
    if not match:
        raise ValueError(f"Invalid interval format: {interval_str}. Use format like '10m', '1h', '30s'")

    value = int(match.group(1))
    unit = match.group(2)

    if unit == 's':
        return timedelta(seconds=value)
    elif unit == 'm':
        return timedelta(minutes=value)
    elif unit == 'h':
        return timedelta(hours=value)


async def get_channel_id(channel_name: str, bot_token: str) -> str:
    """
    Get channel ID from channel name.

    Args:
        channel_name (str): Channel name (without #)
        bot_token (str): Slack bot token

    Returns:
        str: Channel ID
    """
    url = "https://slack.com/api/conversations.list"
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }
    params = {
        "types": "public_channel,private_channel",
        "exclude_archived": "true",
        "limit": 200
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()

    if not data.get("ok"):
        raise Exception(f"Failed to get channels: {data.get('error')}")

    for channel in data.get("channels", []):
        if channel.get("name") == channel_name:
            return channel.get("id")

    raise ValueError(f"Channel '{channel_name}' not found")


async def execute_scan(scan_data: Dict[str, Any], bot_token: str, template_id: str,
                       workspace_id: str, remaining_blocks: List[Dict], action_chain: Dict[str, Any]):
    """
    Execute a scan action - monitor a channel for a specific command continuously.

    This function creates a pending scan record in the database that will be
    checked periodically by a background task. Every time the command is found,
    it executes the remaining blocks, then continues scanning. Runs indefinitely
    until manually stopped.

    Args:
        scan_data (Dict[str, Any]): Dictionary containing:
            - channel_name (str): Name of the Slack channel to monitor
            - command (str): The command to look for (e.g., "!deploy")
            - interval (str): How often to check (e.g., "30s", "1m", "5m")
        bot_token (str): Slack bot token
        template_id (str): Template ID
        workspace_id (str): Workspace ID
        remaining_blocks (List[Dict]): Blocks to execute when command is found
        action_chain (Dict[str, Any]): Full action chain

    Returns:
        dict: Scan execution result
    """
    pending_scans = get_collection("pending_scans")

    # Extract scan parameters
    channel_name = scan_data.get("channel_name")
    command = scan_data.get("command")
    interval_str = scan_data.get("interval", "30m")

    # Validate required fields
    if not channel_name:
        raise ValueError("Scan block requires 'channel_name'")
    if not command:
        raise ValueError("Scan block requires 'command'")

    # Parse interval
    interval_duration = parse_interval(interval_str)

    # Get channel ID
    channel_id = await get_channel_id(channel_name, bot_token)

    # Delete any existing pending scans for this template
    existing_count = await pending_scans.count_documents({
        "template_id": template_id,
        "workspace_id": workspace_id,
        "status": "scanning"
    })

    if existing_count > 0:
        delete_result = await pending_scans.delete_many({
            "template_id": template_id,
            "workspace_id": workspace_id,
            "status": "scanning"
        })
        print(f"Deleted {delete_result.deleted_count} old pending scan(s) for template {template_id}")

    # Calculate next check time
    now = datetime.utcnow()
    next_check_at = now  # Check immediately first time

    # Create pending scan document (continuous scanning - no timeout)
    pending_doc = {
        "template_id": template_id,
        "workspace_id": workspace_id,
        "status": "scanning",

        # What we're looking for
        "channel_name": channel_name,
        "channel_id": channel_id,
        "command": command.lower(),

        # Timing (continuous - no timeout)
        "interval_str": interval_str,
        "interval_seconds": int(interval_duration.total_seconds()),
        "next_check_at": next_check_at,
        "last_checked_at": None,
        "last_message_ts": None,  # Track last processed message to avoid duplicates

        # Execution state
        "bot_token": bot_token,
        "remaining_blocks": remaining_blocks,
        "action_chain": action_chain,

        # Timing
        "created_at": now,

        # Stats
        "times_triggered": 0,  # How many times the command was found
        "last_triggered_at": None
    }

    result = await pending_scans.insert_one(pending_doc)
    scan_id = str(result.inserted_id)

    print(f"Scan block: Monitoring #{channel_name} for command '{command}'")
    print(f"Check interval: {interval_str}")
    print(f"Continuous scanning - triggers every time command is found")
    print(f"Scan ID: {scan_id}")

    return {
        "status": "scanning",
        "channel_name": channel_name,
        "channel_id": channel_id,
        "command": command,
        "interval": interval_str,
        "scan_id": scan_id
    }


async def check_channel_for_command(channel_id: str, command: str, bot_token: str,
                                     last_message_ts: str = None) -> Dict[str, Any]:
    """
    Check a channel for NEW messages containing the command.
    Only returns messages newer than last_message_ts to avoid re-triggering.

    Args:
        channel_id (str): Channel ID to check
        command (str): Command to look for
        bot_token (str): Slack bot token
        last_message_ts (str): Timestamp of last processed message (to avoid duplicates)

    Returns:
        dict: Result with found message info or None
    """
    url = "https://slack.com/api/conversations.history"
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }
    params = {
        "channel": channel_id,
        "limit": 50  # Check last 50 messages
    }

    # Only get messages newer than last checked
    if last_message_ts:
        params["oldest"] = last_message_ts

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()

    if not data.get("ok"):
        print(f"Warning: Could not get channel history: {data.get('error')}")
        return {"found": False, "latest_ts": last_message_ts}

    messages = data.get("messages", [])
    latest_ts = last_message_ts

    # Messages are returned newest first
    # We need to find the latest timestamp AND check for command
    for message in messages:
        msg_ts = message.get("ts")
        msg_text = message.get("text", "").lower()
        msg_user = message.get("user")

        # Update latest timestamp (for tracking what we've seen)
        if not latest_ts or float(msg_ts) > float(latest_ts):
            latest_ts = msg_ts

        # Check if message contains the command
        if command.lower() in msg_text:
            return {
                "found": True,
                "message": message.get("text"),
                "user": msg_user,
                "timestamp": msg_ts,
                "latest_ts": latest_ts
            }

    return {"found": False, "latest_ts": latest_ts}
