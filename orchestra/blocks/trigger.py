"""
Trigger Block Executor

This module handles the execution of trigger blocks in the orchestration system.
Triggers determine how and when a workflow should be executed.
"""

# TODO: need the action block like query the db

# TODO: Add rate limiting (if you hit Slack API limits)
# TODO: Add background tasks (for very long operations)
# TODO: Add retry logic (for transient Slack API errors)
# TODO: Monitor performance (track execution times)

from typing import Union, Dict, Any


async def execute_trigger(trigger_data: Union[str, Dict[str, Any]]):
    """
    Execute a trigger action to initiate a workflow.

    This function processes trigger types to determine how a workflow should
    be executed. Supports manual and scheduled triggers.

    Args:
        trigger_data: Either a string ("manual") or dict with type and schedule config
            - String "manual": Execute immediately
            - Dict {"type": "schedule", "schedule": {...}}: Scheduled execution
            - Dict {"type": "manual"}: Execute immediately

    Returns:
        dict: Trigger execution result containing:
            - status (str): "triggered"
            - type (str): The trigger type that was executed

    Raises:
        ValueError: If an unknown trigger type is provided

    Example:
        >>> result = await execute_trigger("manual")
        >>> print(result)
        {"status": "triggered", "type": "manual"}

        >>> result = await execute_trigger({"type": "schedule", "schedule": {...}})
        >>> print(result)
        {"status": "triggered", "type": "schedule"}
    """
    # Handle dict format (new TriggerConfig format)
    if isinstance(trigger_data, dict):
        trigger_type = trigger_data.get("type", "manual")
    else:
        # Handle string format (legacy)
        trigger_type = trigger_data

    if trigger_type == "manual":
        # Manual trigger - execute immediately
        print(f"Trigger: Manual execution")
        return {"status": "triggered", "type": "manual"}

    elif trigger_type == "schedule":
        # Schedule trigger - executing as part of scheduled job
        print(f"Trigger: Scheduled execution")
        return {"status": "triggered", "type": "schedule"}

    else:
        # Invalid trigger type
        raise ValueError(f"Unknown trigger type: {trigger_type}")