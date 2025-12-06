"""
Await Block Executor

This module handles the execution of await blocks in the orchestration system.
It pauses execution and waits for specific user responses before continuing.
"""

from typing import Dict, Any, List, Union
from database import get_collection
from datetime import datetime, timedelta
import re


def parse_timeout(timeout_str: str) -> timedelta:
    """
    Parse timeout string like '10m', '1h', '30s' into timedelta.

    Args:
        timeout_str (str): Timeout string (e.g., "10m", "1h", "30s")

    Returns:
        timedelta: Parsed timeout duration

    Example:
        >>> parse_timeout("10m")
        timedelta(minutes=10)
        >>> parse_timeout("1h")
        timedelta(hours=1)
    """
    match = re.match(r'^(\d+)([smhd])$', timeout_str.lower())
    if not match:
        raise ValueError(f"Invalid timeout format: {timeout_str}. Use format like '10m', '1h', '30s'")

    value = int(match.group(1))
    unit = match.group(2)

    if unit == 's':
        return timedelta(seconds=value)
    elif unit == 'm':
        return timedelta(minutes=value)
    elif unit == 'h':
        return timedelta(hours=value)
    elif unit == 'd':
        return timedelta(days=value)


async def execute_await(await_data: Union[str, Dict[str, Any]], bot_token: str, channels: List[str], users: List[str],
                        template_id: str, workspace_id: str, remaining_blocks: List[str],
                        action_chain: Dict[str, Any], mode: str = "users", channel_name: str = None):
    """
    Execute an await action - pause execution and wait for user response.

    This function creates a pending execution record in the database that will
    be checked when Slack events are received. The execution resumes when:
    - Users mode: First user responds
    - Channel mode: ALL users in the channel respond (or timeout)

    Args:
        await_data: Either a string or dict with expected_response, timeout, failed
        bot_token (str): Slack bot token
        channels (List[str]): DM channel IDs (users mode) or [channel_id] (channel mode)
        users (List[str]): User IDs who can/must respond
        template_id (str): Template ID
        workspace_id (str): Workspace ID
        remaining_blocks (List[str]): Blocks to execute after completion
        action_chain (Dict[str, Any]): Full action chain
        mode (str): "users" or "channel"
        channel_name (str): Channel name if mode is "channel"

    Returns:
        dict: Await execution result
    """
    pending_executions = get_collection("pending_executions")

    # Parse await_data
    if isinstance(await_data, str):
        expected_response = await_data
        timeout_duration = timedelta(hours=1)
        failure_message = None
    else:
        expected_response = await_data.get("expected_response")
        timeout_str = await_data.get("timeout", "1h")
        timeout_duration = parse_timeout(timeout_str)
        failure_message = await_data.get("failed")

        if not expected_response:
            raise ValueError("await block requires 'expected_response' field")

    # Delete any existing pending executions for this template
    existing_count = await pending_executions.count_documents({
        "template_id": template_id,
        "workspace_id": workspace_id,
        "status": "awaiting_response"
    })

    if existing_count > 0:
        delete_result = await pending_executions.delete_many({
            "template_id": template_id,
            "workspace_id": workspace_id,
            "status": "awaiting_response"
        })
        print(f"🗑️ Deleted {delete_result.deleted_count} old pending execution(s) for template {template_id}")

    # Calculate timeout
    timeout_at = datetime.utcnow() + timeout_duration

    # Create pending execution document
    pending_doc = {
        "template_id": template_id,
        "workspace_id": workspace_id,
        "status": "awaiting_response",
        "expected_response": expected_response.lower(),
        "match_type": "contains",
        "case_sensitive": False,

        # Mode-specific fields
        "mode": mode,  # "users" or "channel"
        "channel_name": channel_name,  # For channel mode

        # Who/where we're listening
        "monitored_channels": channels,
        "monitored_users": users,  # In channel mode, this is ALL channel members
        "users_responded": [],  # Track who has responded

        # Execution state
        "bot_token": bot_token,
        "remaining_blocks": remaining_blocks,
        "action_chain": action_chain,

        # Timing and failure handling
        "created_at": datetime.utcnow(),
        "timeout_at": timeout_at,
        "failure_message": failure_message,

        # Results
        "responses_received": [],
        "completed_at": None
    }

    result = await pending_executions.insert_one(pending_doc)
    execution_id = str(result.inserted_id)

    if mode == "channel":
        print(
            f"Await block (CHANNEL mode): Waiting for '{expected_response}' from ALL {len(users)} members in channel {channel_name}")
    else:
        print(f"Await block (USERS mode): Waiting for '{expected_response}' from {len(users)} users")

    print(f"Monitoring channels: {channels}")
    print(f"Timeout: {timeout_duration} (at {timeout_at.isoformat()})")
    if failure_message:
        print(f"Failure message: '{failure_message}'")
    print(f"Execution ID: {execution_id}")

    return {
        "status": "waiting",
        "mode": mode,
        "expected_response": expected_response,
        "monitored_channels": channels,
        "monitored_users": users,
        "timeout_at": timeout_at.isoformat() + "Z",
        "failure_message": failure_message,
        "execution_id": execution_id
    }


async def check_response_match(user_message: str, expected_response: str, match_type: str = "contains",
                               case_sensitive: bool = False) -> bool:
    """
    Check if a user's message matches the expected response.

    Args:
        user_message (str): The message from the user
        expected_response (str): The expected response to match against
        match_type (str): Type of match - "contains", "exact", or "regex"
        case_sensitive (bool): Whether the match should be case-sensitive

    Returns:
        bool: True if the message matches, False otherwise
    """
    if not case_sensitive:
        user_message = user_message.lower()
        expected_response = expected_response.lower()

    if match_type == "exact":
        return user_message.strip() == expected_response.strip()
    elif match_type == "contains":
        return expected_response in user_message
    elif match_type == "regex":
        import re
        return bool(re.search(expected_response, user_message))

    return False