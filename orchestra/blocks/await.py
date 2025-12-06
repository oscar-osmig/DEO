"""
Await Block Executor

This module handles the execution of await blocks in the orchestration system.
It pauses execution and waits for specific user responses before continuing.
"""

from typing import Dict, Any, List
from database import get_collection
from datetime import datetime, timedelta


async def execute_await(await_data: str, bot_token: str, channels: List[str], users: List[str], template_id: str,
                        workspace_id: str, remaining_blocks: List[str], action_chain: Dict[str, Any]):
    """
    Execute an await action - pause execution and wait for user response.

    This function creates a pending execution record in the database that will
    be checked when Slack events are received. The execution resumes when a
    user sends a message matching the expected response.

    Args:
        await_data (str): The expected response text to wait for (e.g., "got it")
        bot_token (str): Slack bot token for authentication
        channels (List[str]): List of DM channel IDs to monitor for responses
        users (List[str]): List of user IDs who can respond
        template_id (str): ID of the template being executed
        workspace_id (str): ID of the workspace
        remaining_blocks (List[str]): Blocks to execute after await completes
        action_chain (Dict[str, Any]): Full action chain for resuming execution

    Returns:
        dict: Await execution result containing:
            - status (str): "waiting"
            - expected_response (str): The text being waited for
            - monitored_channels (list): Channels being monitored
            - monitored_users (list): Users who can respond
            - timeout_at (str): ISO timestamp when this will timeout
            - execution_id (str): MongoDB ID for this pending execution

    Example:
        >>> result = await execute_await(
        ...     "got it",
        ...     "xoxb-...",
        ...     ["D123", "D456"],
        ...     ["U111", "U222"],
        ...     "template-001",
        ...     "workspace-123",
        ...     ["response"],
        ...     {...}
        ... )
        >>> print(result)
        {
            "status": "waiting",
            "expected_response": "got it",
            "monitored_channels": ["D123", "D456"],
            "monitored_users": ["U111", "U222"],
            "timeout_at": "2025-10-04T09:00:00Z",
            "execution_id": "507f1f77bcf86cd799439011"
        }

    Note:
        - Default timeout is 1 hour
        - Match is case-insensitive and uses "contains" logic
        - First user to respond wins (execution resumes immediately)
        - Timeout handling will mark execution as failed
    """
    pending_executions = get_collection("pending_executions")

    # Calculate timeout (default 1 hour from now)
    timeout_at = datetime.utcnow() + timedelta(hours=1)

    # Create pending execution document
    pending_doc = {
        "template_id": template_id,
        "workspace_id": workspace_id,
        "status": "awaiting_response",
        "expected_response": await_data.lower(),  # Store lowercase for matching
        "match_type": "contains",  # contains, exact, regex
        "case_sensitive": False,

        # Who/where we're listening
        "monitored_channels": channels,
        "monitored_users": users,

        # Execution state
        "bot_token": bot_token,
        "remaining_blocks": remaining_blocks,
        "action_chain": action_chain,

        # Timing
        "created_at": datetime.utcnow(),
        "timeout_at": timeout_at,

        # Results
        "responses_received": [],
        "completed_at": None
    }

    # Insert into database
    result = await pending_executions.insert_one(pending_doc)
    execution_id = str(result.inserted_id)

    print(f"Await block: Waiting for '{await_data}' from users {users}")
    print(f"Monitoring channels: {channels}")
    print(f"Execution ID: {execution_id}")

    return {
        "status": "waiting",
        "expected_response": await_data,
        "monitored_channels": channels,
        "monitored_users": users,
        "timeout_at": timeout_at.isoformat() + "Z",
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

    Example:
        >>> await check_response_match("I got it!", "got it", "contains", False)
        True
        >>> await check_response_match("okay", "got it", "contains", False)
        False
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