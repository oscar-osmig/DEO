"""
Await Block Executor

This module handles the execution of await blocks in the orchestration system.
It pauses execution and waits for specific user responses before continuing.
"""

from typing import Dict, Any, List, Union
from database import get_collection
from datetime import datetime, timedelta
import re
import httpx


async def send_instructions_message(instructions: str, channels: List[str], bot_token: str):
    """
    Send instructions as italic text to the specified channels.

    Args:
        instructions (str): Instructions text to send
        channels (List[str]): List of channel IDs to send to
        bot_token (str): Slack bot token

    Returns:
        list: Results of sending to each channel
    """
    if not instructions:
        return []

    # Format as italic using Slack markdown (underscore wrapping)
    italic_text = f"_{instructions}_"

    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    results = []
    async with httpx.AsyncClient() as client:
        for channel_id in channels:
            try:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    json={"channel": channel_id, "text": italic_text},
                    headers=headers
                )
                response_data = response.json()

                if response_data.get("ok"):
                    print(f"📝 Instructions sent to channel {channel_id}: {instructions}")
                    results.append({"channel": channel_id, "status": "sent"})
                else:
                    print(f"⚠️ Failed to send instructions to {channel_id}: {response_data.get('error')}")
                    results.append({"channel": channel_id, "status": "failed", "error": response_data.get("error")})
            except Exception as e:
                print(f"⚠️ Exception sending instructions to {channel_id}: {str(e)}")
                results.append({"channel": channel_id, "status": "failed", "error": str(e)})

    return results


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
        expected_responses = [expected_response]  # Single response as list
        timeout_duration = timedelta(hours=1)
        failure_message = None
        instructions = None
    else:
        expected_response = await_data.get("expected_response", "")
        timeout_str = await_data.get("timeout", "1h")
        timeout_duration = parse_timeout(timeout_str)
        failure_message = await_data.get("failed") or await_data.get("failure_message")
        instructions = await_data.get("instructions")

        # Parse multiple expected responses (comma-separated or already a list)
        if isinstance(expected_response, list):
            expected_responses = [r.strip().lower() for r in expected_response if r.strip()]
        elif expected_response:
            # Split by comma for multiple options (e.g., "yes, no" -> ["yes", "no"])
            expected_responses = [r.strip().lower() for r in expected_response.split(",") if r.strip()]
        else:
            expected_responses = []

        if not expected_responses:
            raise ValueError("await block requires at least one expected response")

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
        "expected_response": expected_response.lower() if expected_response else "",  # Keep for backwards compat
        "expected_responses": expected_responses,  # List of valid responses (OR logic)
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
        "instructions": instructions,  # Instructions text to display

        # Results
        "responses_received": [],
        "completed_at": None
    }

    result = await pending_executions.insert_one(pending_doc)
    execution_id = str(result.inserted_id)

    responses_str = " OR ".join(f"'{r}'" for r in expected_responses)
    if mode == "channel":
        print(f"Await block (CHANNEL mode): Waiting for {responses_str} from ALL {len(users)} members in channel {channel_name}")
    else:
        print(f"Await block (USERS mode): Waiting for {responses_str} from {len(users)} users")

    print(f"Monitoring channels: {channels}")
    print(f"Timeout: {timeout_duration} (at {timeout_at.isoformat()})")
    if instructions:
        print(f"Instructions: '{instructions}'")
    if failure_message:
        print(f"Failure message: '{failure_message}'")
    print(f"Execution ID: {execution_id}")

    # Send instructions as italic text to the channels
    instructions_results = []
    if instructions:
        instructions_results = await send_instructions_message(instructions, channels, bot_token)

    return {
        "status": "waiting",
        "mode": mode,
        "expected_response": expected_response,
        "expected_responses": expected_responses,
        "instructions": instructions,
        "instructions_sent": instructions_results,
        "monitored_channels": channels,
        "monitored_users": users,
        "timeout_at": timeout_at.isoformat() + "Z",
        "failure_message": failure_message,
        "execution_id": execution_id
    }


async def check_response_match(user_message: str, expected_response: str, match_type: str = "contains",
                               case_sensitive: bool = False, expected_responses: List[str] = None) -> bool:
    """
    Check if a user's message matches the expected response(s).

    Supports multiple expected responses with OR logic - if any match, returns True.

    Args:
        user_message (str): The message from the user
        expected_response (str): The expected response to match against (legacy, single value)
        match_type (str): Type of match - "contains", "exact", or "regex"
        case_sensitive (bool): Whether the match should be case-sensitive
        expected_responses (List[str]): List of valid responses (OR logic) - preferred over expected_response

    Returns:
        bool: True if the message matches any expected response, False otherwise
    """
    if not case_sensitive:
        user_message = user_message.lower()

    # Use expected_responses list if provided, otherwise fall back to single expected_response
    responses_to_check = expected_responses if expected_responses else [expected_response]

    for response in responses_to_check:
        if not response:
            continue

        check_response = response.lower() if not case_sensitive else response

        if match_type == "exact":
            if user_message.strip() == check_response.strip():
                return True
        elif match_type == "contains":
            if check_response in user_message:
                return True
        elif match_type == "regex":
            if re.search(check_response, user_message):
                return True

    return False