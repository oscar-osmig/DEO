
---

# FastAPI Workspace & Slack Backend

![Python](https://img.shields.io/badge/python-3.9+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)

---

## Table of Contents

* [Overview](#overview)
* [Features](#features)
* [Project Structure](#project-structure)
* [Installation](#installation)
* [Configuration](#configuration)
* [Usage](#usage)

  * [Running the Server](#running-the-server)
  * [Quickstart Example](#quickstart-example)
* [API Reference](#api-reference)

  * [Authentication & Sessions](#authentication--sessions)
  * [Workspace Management](#workspace-management)
  * [Slack Messaging](#slack-messaging)
  * [Database Health Check](#database-health-check)
* [Modules](#modules)
* [Troubleshooting](#troubleshooting)

---

## Overview

This project is a **FastAPI backend** with **MongoDB Atlas** and **Slack integration**.
It provides APIs for managing workspaces and sending automated Slack messages.

---

## Features

* FastAPI + Uvicorn backend
* MongoDB Atlas integration with async support
* Slack Bot messaging with error handling
* Session-based user authentication
* Modular router-based architecture

---

## Project Structure

```
.
├── database.py          # MongoDB connection utilities
├── slack.py             # Slack message execution
├── workspace.py         # Workspace creation endpoint
├── main.py              # FastAPI application entry point
```

---

## Installation

### Prerequisites

* Python 3.9+
* MongoDB Atlas or local MongoDB instance
* Slack bot token

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/fastapi-slack-workspace.git
cd fastapi-slack-workspace

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

# Install dependencies
pip install -r requirements.txt
```

---

## Configuration

* Update **MongoDB connection string** in `database.py` (`MONGODB_URL`).
* Replace `"your-secret-key-min-32-chars-long-12345"` in `main.py` with a secure secret key.
* Store secrets in a `.env` file for safety (recommended).

Example `.env`:

```env
MONGODB_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net
SECRET_KEY=super-secure-key
SLACK_BOT_TOKEN=xoxb-123456789
```

---

## Usage

### Running the Server

```bash
uvicorn main:app --reload
```

Server will start at: [http://localhost:8000](http://localhost:8000)

### Quickstart Example

```bash
# Create a workspace
curl -X POST http://localhost:8000/workspace/make-workspace \
-H "Content-Type: application/json" \
-d '{
  "bot_token": "xoxb-your-token",
  "workspace_name": "Team Alpha",
  "workspace_id": "alpha_123"
}'
```

---

## API Reference

### Authentication & Sessions

* Managed via **FastAPI SessionMiddleware**.
* Session is set after user login (not included in current codebase).
* Endpoints requiring authentication expect `request.session["user_email"]`.

---

### Workspace Management

#### `POST /workspace/make-workspace`

Create a new workspace for an authenticated user.

**Request Body**

```json
{
  "bot_token": "xoxb-your-slack-bot-token",
  "workspace_name": "Team Alpha",
  "workspace_id": "alpha_123"
}
```

**Responses**

* ✅ `200 OK` – Workspace created successfully
* ❌ `401 Unauthorized` – User not logged in
* ❌ `404 Not Found` – Account missing
* ❌ `400 Bad Request` – Workspace ID already exists

---

### Slack Messaging

#### `POST /slack/message` *(from `execute_message`)*

Send a message to a Slack channel.

**Request Body**

```json
{
  "channel_name": "#general",
  "message": "Hello team, deployment completed!"
}
```

**Headers**

```http
Authorization: Bearer <SLACK_BOT_TOKEN>
```

**Responses**

* ✅ `200 OK` – Message sent successfully
* ❌ `400 Bad Request` – Missing channel or message
* ❌ `500 Internal Server Error` – Slack API error

---

### Database Health Check

*(Suggested utility endpoint – not yet implemented but recommended for monitoring)*

#### `GET /ping`

Check if MongoDB is connected.

**Response**

```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## Modules

### `database.py`

* Manages MongoDB connection lifecycle
* Provides `get_collection` for MongoDB collections

### `slack.py`

* Sends messages to Slack channels with `execute_message`
* Handles Slack API errors

### `workspace.py`

* Exposes `/workspace/make-workspace` endpoint
* Saves workspace data in MongoDB

### `main.py`

* Configures FastAPI app and routers
* Adds session middleware
* Handles MongoDB lifecycle

---

## Troubleshooting

* **MongoDB Connection Issues**

  * Check IP whitelist in MongoDB Atlas
  * Disable VPN/firewall if blocking access
  * Allow `0.0.0.0/0` for local testing

* **Slack Messaging Issues**

  * Ensure bot is added to the channel
  * Verify the token is valid

---
