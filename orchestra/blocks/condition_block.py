"""
Condition Block Executor

This module handles the execution of condition blocks in the orchestration system.
It evaluates conditions based on execution context and determines which path to follow.
"""

from typing import Dict, Any, List, Optional
import re


async def execute_condition(config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a condition block - evaluate conditions and determine output path.

    This function checks the specified variable against defined conditions and
    returns which output side to follow for the next block.

    Args:
        config (Dict[str, Any]): Condition configuration containing:
            - variable (str): Variable to check (e.g., "last_response")
            - conditions (List[Dict]): List of condition objects with:
                - operator (str): Comparison operator
                - value (str): Value to compare against
                - output_side (str): Output connector to follow if matched
            - default_output (str): Output to use if no conditions match

        context (Dict[str, Any]): Execution context containing:
            - last_response (str): Last response text from await block
            - last_user (str): User who responded
            - Other execution data...

    Returns:
        Dict[str, Any]: Result containing:
            - matched (bool): Whether a condition was matched
            - condition_index (int): Index of matched condition (-1 if default)
            - output_side (str): Which output connector to follow
            - evaluated_value (str): The value that was evaluated

    Example:
        >>> config = {
        ...     "variable": "last_response",
        ...     "conditions": [
        ...         {"operator": "equals", "value": "yes", "output_side": "bottom"},
        ...         {"operator": "equals", "value": "no", "output_side": "right"}
        ...     ],
        ...     "default_output": "left"
        ... }
        >>> context = {"last_response": "yes"}
        >>> result = await execute_condition(config, context)
        >>> result['output_side']
        'bottom'
    """
    variable = config.get("variable", "last_response")
    conditions = config.get("conditions", [])
    default_output = config.get("default_output", "bottom")

    # Get the value to check from context
    value_to_check = context.get(variable, "")

    # Convert to string for comparison
    if value_to_check is None:
        value_to_check = ""
    else:
        value_to_check = str(value_to_check)

    print(f"\n🔀 Condition block: Checking '{variable}' = '{value_to_check}'")

    # Evaluate each condition in order
    for i, condition in enumerate(conditions):
        operator = condition.get("operator", "equals")
        expected_value = condition.get("value", "")
        output_side = condition.get("output_side", "bottom")

        is_match = evaluate_condition(value_to_check, operator, expected_value)

        print(f"   Condition {i + 1}: {value_to_check} {operator} '{expected_value}' = {is_match}")

        if is_match:
            print(f"   ✅ Match! Following {output_side} path")
            return {
                "matched": True,
                "condition_index": i,
                "output_side": output_side,
                "evaluated_value": value_to_check,
                "matched_operator": operator,
                "matched_value": expected_value
            }

    # No conditions matched - use default
    print(f"   ❌ No match. Following default path: {default_output}")
    return {
        "matched": False,
        "condition_index": -1,
        "output_side": default_output,
        "evaluated_value": value_to_check
    }


def evaluate_condition(value: str, operator: str, expected: str) -> bool:
    """
    Evaluate a single condition.

    Args:
        value (str): The actual value to check
        operator (str): The comparison operator
        expected (str): The expected value to compare against

    Returns:
        bool: Whether the condition is satisfied

    Supported operators:
        - equals: Exact match (case-insensitive)
        - not_equals: Not an exact match
        - contains: Value contains expected (case-insensitive)
        - not_contains: Value does not contain expected
        - starts_with: Value starts with expected (case-insensitive)
        - ends_with: Value ends with expected (case-insensitive)
        - regex: Expected is a regex pattern to match
        - is_empty: Value is empty or whitespace only
        - is_not_empty: Value is not empty
        - greater_than: Numeric comparison
        - less_than: Numeric comparison
    """
    # Normalize for case-insensitive comparison
    value_lower = value.lower().strip()
    expected_lower = expected.lower().strip()

    if operator == "equals":
        return value_lower == expected_lower

    elif operator == "not_equals":
        return value_lower != expected_lower

    elif operator == "contains":
        return expected_lower in value_lower

    elif operator == "not_contains":
        return expected_lower not in value_lower

    elif operator == "starts_with":
        return value_lower.startswith(expected_lower)

    elif operator == "ends_with":
        return value_lower.endswith(expected_lower)

    elif operator == "regex":
        try:
            return bool(re.search(expected, value, re.IGNORECASE))
        except re.error:
            print(f"   ⚠️ Invalid regex pattern: {expected}")
            return False

    elif operator == "is_empty":
        return len(value.strip()) == 0

    elif operator == "is_not_empty":
        return len(value.strip()) > 0

    elif operator == "greater_than":
        try:
            return float(value) > float(expected)
        except ValueError:
            return False

    elif operator == "less_than":
        try:
            return float(value) < float(expected)
        except ValueError:
            return False

    else:
        print(f"   ⚠️ Unknown operator: {operator}")
        return False


def get_available_variables() -> List[Dict[str, str]]:
    """
    Get list of available variables for condition checking.

    Returns:
        List[Dict[str, str]]: List of variable options with id and label
    """
    return [
        {"id": "last_response", "label": "Last Response"},
        {"id": "last_user", "label": "Last User ID"},
        {"id": "response_count", "label": "Response Count"},
    ]


def get_available_operators() -> List[Dict[str, str]]:
    """
    Get list of available comparison operators.

    Returns:
        List[Dict[str, str]]: List of operator options with id and label
    """
    return [
        {"id": "equals", "label": "equals"},
        {"id": "not_equals", "label": "not equals"},
        {"id": "contains", "label": "contains"},
        {"id": "not_contains", "label": "does not contain"},
        {"id": "starts_with", "label": "starts with"},
        {"id": "ends_with", "label": "ends with"},
        {"id": "is_empty", "label": "is empty"},
        {"id": "is_not_empty", "label": "is not empty"},
        {"id": "regex", "label": "matches regex"},
    ]
