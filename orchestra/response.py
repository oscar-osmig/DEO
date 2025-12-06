async def execute_response(response_data: str):
    """
    Execute response action - final message/output

    Args:
        response_data: Response text
    """
    print(f"Response: {response_data}")

    return {
        "status": "completed",
        "response": response_data
    }