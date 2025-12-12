"""
Templates Management Module

This module handles CRUD operations for workflow templates and their execution.
Templates define action chains that orchestrate multiple blocks in sequence.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator, field_validator
from typing import Dict, List, Any, Optional, Union, Literal
from database import get_collection
from datetime import datetime
from .orchestrate import TemplateOrchestrator  # ✅ Keep this

router = APIRouter(prefix="/templates", tags=["templates"])


class MessageBlock(BaseModel):
    """
    Message block configuration model.

    Supports two modes:
    1. Channel mode: Send to a specific channel
    2. Users mode: Send DMs to multiple users

    Attributes:
        channel_name (Optional[str]): Slack channel name or ID (for channel mode)
        users (Optional[List[str]]): List of user IDs (for users mode)
        message (str): Message text to send

    Note:
        Must provide either channel_name OR users, but not both.
    """
    channel_name: Optional[str] = None
    users: Optional[List[str]] = None
    message: str

    @model_validator(mode='after')
    def validate_mode(self):
        """Validate that either channel_name or users is provided, but not both."""
        if not self.channel_name and not self.users:
            raise ValueError("Must provide either 'channel_name' or 'users'")
        if self.channel_name and self.users:
            raise ValueError("Cannot provide both 'channel_name' and 'users'")
        return self


class BlockWithConfig(BaseModel):
    """
    Block with inline configuration.

    NEW FORMAT: Each block in the sequence has its own config.
    This supports multiple message blocks with different configs.
    """
    type: str
    config: Optional[Dict[str, Any]] = None


class ScheduleConfig(BaseModel):
    """
    Schedule configuration model.

    Attributes:
        regularity: How often to run
        time: Time to run in HH:MM format (required for daily/weekly/monthly)
        day_of_week: 0-6 for weekly (0=Monday) (required for weekly)
        day_of_month: 1-31 (required for monthly)
        date: ISO datetime string (required for once)
        interval_minutes: Number of minutes (required for interval)
    """
    regularity: Literal["daily", "weekly", "monthly", "once", "interval"]
    time: Optional[str] = None  # Required for daily/weekly/monthly
    day_of_week: Optional[int] = None  # Required for weekly
    day_of_month: Optional[int] = None  # Required for monthly
    date: Optional[str] = None  # Required for once
    interval_minutes: Optional[int] = None  # Required for interval

class TriggerConfig(BaseModel):
    """
    Trigger configuration - either manual or scheduled.
    """
    type: Literal["manual", "schedule"]
    schedule: Optional[ScheduleConfig] = None


from pydantic import field_validator


class ActionChain(BaseModel):
    """
    Action chain configuration model.

    Defines the sequence of blocks and their configurations for a template.

    NEW FORMAT: blocks is a list of BlockWithConfig objects, each containing
    type and config inline. This supports multiple blocks of the same type
    with different configurations.

    OLD FORMAT (deprecated but still supported for backwards compatibility):
    blocks as list of strings with separate message/await/response fields.
    """
    # NEW FORMAT: blocks as list of objects with type and config
    # OLD FORMAT: blocks as list of strings
    blocks: Union[List[BlockWithConfig], List[str], List[Dict[str, Any]]]
    trigger: Union[str, TriggerConfig, Dict[str, Any]]  # Accept dict too

    # Canvas layout for read-only diagram display
    canvas_layout: Optional[Dict[str, Any]] = None

    # OLD FORMAT fields (optional for backwards compatibility)
    message: Optional[MessageBlock] = None
    await_response: Optional[Union[str, Dict[str, str]]] = Field(None, alias="await")
    response: Optional[str] = None

    class Config:
        populate_by_name = True

    @field_validator('trigger', mode='before')
    @classmethod
    def validate_trigger(cls, v):
        """Convert dict to TriggerConfig if needed."""
        if isinstance(v, dict) and 'type' in v:
            # Convert dict to TriggerConfig
            return TriggerConfig(**v)
        return v

    @field_validator('blocks', mode='before')
    @classmethod
    def validate_blocks(cls, v):
        """Convert blocks to proper format."""
        if not v:
            return v
        # Check if new format (list of dicts with 'type' key)
        if isinstance(v[0], dict) and 'type' in v[0]:
            return [BlockWithConfig(**b) for b in v]
        # Old format (list of strings)
        return v


class CreateTemplateRequest(BaseModel):
    """
    Request model for creating a new template.

    Attributes:
        template_id (str): Unique identifier for the template
        workspace_id (str): ID of the workspace this template belongs to
        action_chain (ActionChain): The workflow configuration
    """
    template_id: str
    workspace_id: str
    action_chain: ActionChain


class UpdateTemplateRequest(BaseModel):
    """
    Request model for updating an existing template.

    Attributes:
        action_chain (ActionChain): Updated workflow configuration
    """
    action_chain: ActionChain


class RunTemplateRequest(BaseModel):
    """
    Request model for executing a template.

    Attributes:
        template_id (str): ID of the template to execute
    """
    template_id: str


class StartScheduleRequest(BaseModel):
    """Request to start scheduled execution."""
    template_id: str


class StopScheduleRequest(BaseModel):
    """Request to stop scheduled execution."""
    template_id: str


# ... rest of the endpoints follow ...
@router.post("/create")
async def create_template(request: CreateTemplateRequest):
    """
    Create a new workflow template.

    Creates a template with blocks that execute in sequence. Supports two formats:

    NEW FORMAT (recommended):
    - blocks: List of {type, config} objects with inline configurations
    - Supports multiple blocks of the same type with different configs

    OLD FORMAT (backwards compatible):
    - blocks: List of strings
    - message, await, response as separate fields

    Args:
        request (CreateTemplateRequest): Contains template_id, workspace_id, action_chain

    Returns:
        dict: {"success": True, "template_id": str, "workspace_id": str}

    Raises:
        HTTPException 400: If template_id already exists
    """
    templates_collection = get_collection("templates")

    # Check if template_id already exists
    existing = await templates_collection.find_one({"template_id": request.template_id})
    if existing:
        raise HTTPException(status_code=400, detail="Template ID already exists")

    # Handle trigger serialization
    trigger_data = request.action_chain.trigger
    if isinstance(trigger_data, TriggerConfig):
        trigger_data = trigger_data.model_dump(exclude_none=True)
    elif isinstance(trigger_data, str):
        trigger_data = trigger_data

    # Check if new format (blocks with inline config)
    blocks = request.action_chain.blocks
    is_new_format = blocks and isinstance(blocks[0], BlockWithConfig)

    if is_new_format:
        # NEW FORMAT: blocks as list of {type, config} objects
        blocks_data = [
            {"type": b.type, "config": b.config}
            for b in blocks
        ]

        action_chain_data = {
            "blocks": blocks_data,
            "trigger": trigger_data
        }

        # Include canvas_layout if provided (for read-only diagram display)
        if request.action_chain.canvas_layout:
            action_chain_data["canvas_layout"] = request.action_chain.canvas_layout

        template_doc = {
            "template_id": request.template_id,
            "workspace_id": request.workspace_id,
            "action_chain": action_chain_data,
            "created_at": datetime.utcnow()
        }
    else:
        # OLD FORMAT: blocks as list of strings with separate message/await/response
        message_block = {"message": request.action_chain.message.message}

        if request.action_chain.message.channel_name:
            message_block["channel_name"] = request.action_chain.message.channel_name
        elif request.action_chain.message.users:
            message_block["users"] = request.action_chain.message.users

        template_doc = {
            "template_id": request.template_id,
            "workspace_id": request.workspace_id,
            "action_chain": {
                "blocks": request.action_chain.blocks,
                "trigger": trigger_data,
                "message": message_block,
                "response": request.action_chain.response
            },
            "created_at": datetime.utcnow()
        }

        # Add await field if present
        if request.action_chain.await_response:
            template_doc["action_chain"]["await"] = request.action_chain.await_response

    result = await templates_collection.insert_one(template_doc)

    return {
        "success": True,
        "template_id": request.template_id,
        "workspace_id": request.workspace_id
    }


@router.put("/update/{template_id}")
async def update_template(template_id: str, request: UpdateTemplateRequest):
    """
    Update an existing template's action chain.

    Supports both new format (blocks with inline config) and old format.

    Args:
        template_id (str): ID of template to update
        request (UpdateTemplateRequest): Contains updated action_chain

    Returns:
        dict: {"success": True, "template_id": str, "workspace_id": str, "modified_count": int}

    Raises:
        HTTPException 404: If template not found
    """
    templates_collection = get_collection("templates")

    # Check if template exists
    existing_template = await templates_collection.find_one({"template_id": template_id})
    if not existing_template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Handle trigger serialization
    trigger_data = request.action_chain.trigger
    if isinstance(trigger_data, TriggerConfig):
        trigger_data = trigger_data.model_dump(exclude_none=True)
    elif isinstance(trigger_data, str):
        trigger_data = trigger_data

    # Check if new format (blocks with inline config)
    blocks = request.action_chain.blocks
    is_new_format = blocks and isinstance(blocks[0], BlockWithConfig)

    if is_new_format:
        # NEW FORMAT: blocks as list of {type, config} objects
        blocks_data = [
            {"type": b.type, "config": b.config}
            for b in blocks
        ]

        action_chain_data = {
            "blocks": blocks_data,
            "trigger": trigger_data
        }

        # Include canvas_layout if provided (for read-only diagram display)
        if request.action_chain.canvas_layout:
            action_chain_data["canvas_layout"] = request.action_chain.canvas_layout

        updated_data = {
            "action_chain": action_chain_data,
            "updated_at": datetime.utcnow()
        }
    else:
        # OLD FORMAT: blocks as list of strings with separate message/await/response
        message_block = {"message": request.action_chain.message.message}

        if request.action_chain.message.channel_name:
            message_block["channel_name"] = request.action_chain.message.channel_name
        elif request.action_chain.message.users:
            message_block["users"] = request.action_chain.message.users

        updated_data = {
            "action_chain": {
                "blocks": request.action_chain.blocks,
                "trigger": trigger_data,
                "message": message_block,
                "response": request.action_chain.response
            },
            "updated_at": datetime.utcnow()
        }

        # Add await field if present
        if request.action_chain.await_response:
            updated_data["action_chain"]["await"] = request.action_chain.await_response

    # Update template in database
    result = await templates_collection.update_one(
        {"template_id": template_id},
        {"$set": updated_data}
    )

    return {
        "success": True,
        "template_id": template_id,
        "workspace_id": existing_template["workspace_id"],
        "modified_count": result.modified_count
    }


@router.delete("/delete/{template_id}")
async def delete_template(template_id: str):
    """
    Delete a specific template by its ID.

    Permanently removes a template from the database. This operation
    cannot be undone.

    Args:
        template_id (str): ID of the template to delete

    Returns:
        dict: Deletion result containing success, template_id, workspace_id, and deleted_count

    Raises:
        HTTPException: 404 if template not found
    """
    templates_collection = get_collection("templates")

    # Check if template exists
    existing_template = await templates_collection.find_one({"template_id": template_id})
    if not existing_template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Delete template
    result = await templates_collection.delete_one({"template_id": template_id})

    return {
        "success": True,
        "template_id": template_id,
        "workspace_id": existing_template["workspace_id"],
        "deleted_count": result.deleted_count
    }


@router.delete("/delete/workspace/{workspace_id}")
async def delete_all_templates(workspace_id: str):
    """
    Delete all templates belonging to a specific workspace.

    Removes all templates associated with a workspace. Useful when
    deleting a workspace or performing bulk cleanup.

    Args:
        workspace_id (str): ID of the workspace whose templates should be deleted

    Returns:
        dict: Deletion result containing success, workspace_id, and deleted_count

    Raises:
        HTTPException: 404 if no templates found for this workspace
    """
    templates_collection = get_collection("templates")

    # Count templates before deleting
    count = await templates_collection.count_documents({"workspace_id": workspace_id})

    if count == 0:
        raise HTTPException(status_code=404, detail="No templates found for this workspace")

    # Delete all templates for this workspace
    result = await templates_collection.delete_many({"workspace_id": workspace_id})

    return {
        "success": True,
        "workspace_id": workspace_id,
        "deleted_count": result.deleted_count
    }


@router.post("/run")
async def run_template(request: RunTemplateRequest):
    """
    Execute a template's workflow.

    Retrieves a template by its ID, gets the associated workspace's bot token,
    validates the template structure, and orchestrates the execution of all
    blocks in the defined sequence.

    Args:
        request (RunTemplateRequest): Execution request containing template_id

    Returns:
        dict: Execution result with success, template_id, workspace_id, and execution_results

    Raises:
        HTTPException: 404 if template or workspace not found
        HTTPException: 400 if workspace lacks bot_token or template lacks action_chain
        HTTPException: 400 if template validation fails
        HTTPException: 500 if orchestration execution fails
    """
    # Get the template by template_id
    templates_collection = get_collection("templates")
    template = await templates_collection.find_one({"template_id": request.template_id})

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get workspace_id from template
    workspace_id = template.get("workspace_id")

    # Get the workspace to retrieve bot_token
    workspaces_collection = get_collection("workspaces")
    workspace = await workspaces_collection.find_one({"workspace_id": workspace_id})

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get bot token from workspace
    bot_token = workspace.get("bot_token")
    if not bot_token:
        raise HTTPException(status_code=400, detail="Workspace does not have a bot_token")

    # Get action chain from template
    action_chain = template.get("action_chain")
    if not action_chain:
        raise HTTPException(status_code=400, detail="Template does not have an action_chain")

    # Create orchestrator and validate template
    try:
        orchestrator = TemplateOrchestrator(
            action_chain,
            bot_token,
            template_id=request.template_id,
            workspace_id=workspace_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Execute the orchestration
    try:
        results = await orchestrator.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orchestration failed: {str(e)}")

    return {
        "success": True,
        "template_id": request.template_id,
        "workspace_id": workspace_id,
        "execution_results": results
    }


class StartScheduleRequest(BaseModel):
    """Request to start scheduled execution."""
    template_id: str


class StopScheduleRequest(BaseModel):
    """Request to stop scheduled execution."""
    template_id: str


@router.post("/schedule/start")
async def start_schedule(request: StartScheduleRequest):
    """
    Start scheduled execution of a template.

    The template must have trigger.type = "schedule" with schedule config.
    """
    from orchestra.scheduler import schedule_template

    templates_collection = get_collection("templates")
    template = await templates_collection.find_one({"template_id": request.template_id})

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    action_chain = template.get("action_chain", {})
    trigger = action_chain.get("trigger", {})

    # Support old string format (manual only) and new dict format
    if isinstance(trigger, str):
        raise HTTPException(
            status_code=400,
            detail="Template has manual trigger. Update trigger to 'schedule' type with schedule config."
        )

    if trigger.get("type") != "schedule":
        raise HTTPException(status_code=400, detail="Template trigger type must be 'schedule'")

    schedule_config = trigger.get("schedule")
    if not schedule_config:
        raise HTTPException(status_code=400, detail="Template missing schedule configuration")

    workspace_id = template.get("workspace_id")

    try:
        job_id = await schedule_template(request.template_id, workspace_id, schedule_config)
        return {
            "success": True,
            "template_id": request.template_id,
            "job_id": job_id,
            "schedule": schedule_config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to schedule: {str(e)}")


@router.post("/schedule/stop")
async def stop_schedule(request: StopScheduleRequest):
    """
    Stop scheduled execution of a template.
    """
    from orchestra.scheduler import unschedule_template

    templates_collection = get_collection("templates")
    template = await templates_collection.find_one({"template_id": request.template_id})

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    workspace_id = template.get("workspace_id")
    job_id = f"{request.template_id}_{workspace_id}"

    try:
        await unschedule_template(job_id)
        return {
            "success": True,
            "template_id": request.template_id,
            "job_id": job_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop schedule: {str(e)}")


@router.get("/schedule/list")
async def list_schedules():
    """List all active schedules."""
    schedules_collection = get_collection("active_schedules")
    active = await schedules_collection.find({"status": "active"}).to_list(length=1000)

    return {
        "success": True,
        "schedules": active,
        "count": len(active)
    }

@router.get("")
async def get_templates(workspace_id: Optional[str] = Query(None)):
    """
    Get all templates, optionally filtered by workspace_id.

    Args:
        workspace_id (Optional[str]): Filter templates by workspace ID

    Returns:
        dict: {"success": True, "templates": [...], "count": int}
    """
    templates_collection = get_collection("templates")

    query = {}
    if workspace_id:
        query["workspace_id"] = workspace_id

    templates = await templates_collection.find(query).to_list(length=100)

    # Convert ObjectId to string
    for template in templates:
        template['_id'] = str(template['_id'])

    return {
        "success": True,
        "templates": templates,
        "count": len(templates)
    }


@router.get("/by-id/{template_id}")
async def get_template_by_id(template_id: str):
    """Get a single template by its ID."""
    templates_collection = get_collection("templates")

    template = await templates_collection.find_one({"template_id": template_id})

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template['_id'] = str(template['_id'])

    return {
        "success": True,
        "template": template
    }