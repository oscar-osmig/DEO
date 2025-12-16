# DEO - Slack Workflow Automation Platform

![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

DEO is a comprehensive Slack workflow automation platform that enables teams to create, schedule, and execute complex multi-step workflows with interactive components, all integrated directly into Slack.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Slack App Setup](#slack-app-setup)
- [Usage](#usage)
  - [Running the Server](#running-the-server)
  - [Development Mode](#development-mode)
- [Architecture](#architecture)
  - [Backend Framework](#backend-framework)
  - [Database Schema](#database-schema)
  - [Frontend Technologies](#frontend-technologies)
- [Core Modules](#core-modules)
  - [Authentication (oauth.py)](#authentication-oauthpy)
  - [Workspace Management (workspace.py)](#workspace-management-workspacepy)
  - [Account Management (account.py)](#account-management-accountpy)
  - [Template System (templates.py)](#template-system-templatespy)
  - [Orchestration Engine (orchestrate.py)](#orchestration-engine-orchestratepy)
  - [Scheduler (scheduler.py)](#scheduler-schedulerpy)
  - [Team Management (teams.py)](#team-management-teamspy)
  - [Dashboards (dashboards.py)](#dashboards-dashboardspy)
  - [Job Applications (applications.py)](#job-applications-applicationspy)
  - [Slack Events (endpoints.py)](#slack-events-endpointspy)
- [Workflow Blocks](#workflow-blocks)
  - [Trigger Block](#trigger-block)
  - [Message Block](#message-block)
  - [Await Block](#await-block)
  - [Condition Block](#condition-block)
  - [Scan Block](#scan-block)
  - [Response Block](#response-block)
- [API Reference](#api-reference)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Account Endpoints](#account-endpoints)
  - [Workspace Endpoints](#workspace-endpoints)
  - [Template Endpoints](#template-endpoints)
  - [Team Endpoints](#team-endpoints)
  - [Dashboard Endpoints](#dashboard-endpoints)
  - [Application Endpoints](#application-endpoints)
  - [Slack Endpoints](#slack-endpoints)
  - [Feedback Endpoint](#feedback-endpoint)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [Fly.io](#flyio)
  - [Vercel](#vercel)
- [Troubleshooting](#troubleshooting)

---

## Overview

DEO (short for "Deo Orchestrator") is a FastAPI-based backend platform with a rich frontend interface that allows users to:

- Build visual workflows using a drag-and-drop canvas interface
- Automate Slack messaging with conditional logic and user interaction
- Schedule recurring tasks (daily, weekly, monthly, or custom intervals)
- Monitor channels for specific commands or keywords
- Create team dashboards for tracking metrics
- Manage job application forms with Slack integration
- Collaborate across multiple Slack workspaces

---

## Features

- **Visual Workflow Builder**: Drag-and-drop template creation with block-based execution
- **Slack Bot Integration**: Full Slack API integration for messaging, channels, and events
- **Scheduled Execution**: Run workflows on schedules (daily, weekly, monthly, intervals)
- **Interactive Awaits**: Pause workflows waiting for user responses with timeout support
- **Conditional Branching**: Different execution paths based on response conditions
- **Channel Monitoring**: Scan channels for specific commands or patterns
- **Team Collaboration**: Create teams, invite members, and manage permissions
- **Metrics Dashboards**: Custom dashboards for team metrics tracking with public access
- **Job Applications**: Public job application forms with Slack notifications
- **Multi-workspace Support**: Manage multiple Slack workspaces from one account
- **Token Management**: Save and manage multiple Slack bot tokens
- **Execution Tracking**: Complete history of template executions (pending, completed, failed)
- **Background Monitoring**: Automatic timeout and scan monitoring loops
- **Google OAuth**: Secure authentication via Google Sign-In
- **Responsive UI**: Mobile-friendly dark-themed interface with glassmorphism effects

---

## Project Structure

```
FastAPIProject/
├── main.py                          # FastAPI application entry point
├── requirements.txt                 # Python dependencies
├── .env                             # Environment configuration
├── Dockerfile                       # Docker containerization
├── fly.toml                         # Fly.io deployment config
├── vercel.json                      # Vercel deployment config
├── manifest.json                    # Slack App manifest
├── README.md                        # Project documentation
│
├── database/
│   ├── __init__.py
│   └── database.py                  # MongoDB connection management
│
├── models/
│   └── __init__.py                  # Data models
│
├── endpoints/
│   ├── __init__.py
│   ├── endpoints.py                 # Slack API endpoints and event handlers
│   └── models.py                    # Pydantic request/response models
│
├── orchestra/                       # Core orchestration system
│   ├── __init__.py                  # Router exports
│   ├── account.py                   # User account management
│   ├── workspace.py                 # Workspace management
│   ├── oauth.py                     # Google OAuth authentication
│   ├── teams.py                     # Team management
│   ├── templates.py                 # Template CRUD and execution
│   ├── dashboards.py                # Dashboard creation and metrics
│   ├── applications.py              # Job application forms
│   ├── orchestrate.py               # Template execution orchestrator
│   ├── scheduler.py                 # APScheduler for scheduled templates
│   ├── response.py                  # Response handling utilities
│   └── blocks/                      # Workflow block implementations
│       ├── __init__.py
│       ├── trigger.py               # Trigger block (schedule, webhook)
│       ├── message.py               # Message block (Slack messages)
│       ├── await_block.py           # Await block (wait for response)
│       ├── await.py                 # Await utility functions
│       ├── condition_block.py       # Condition block (branching)
│       ├── response.py              # Response block
│       ├── scan.py                  # Scan block (monitor channels)
│       ├── timeout_checker.py       # Background timeout monitoring
│       └── scan_checker.py          # Background scan monitoring
│
├── static/                          # Frontend files
│   ├── login.html                   # Login page
│   ├── app.html                     # Main application shell
│   ├── favicon.png                  # Site favicon
│   ├── css/                         # Stylesheets
│   │   ├── app.css                  # Main app styles
│   │   ├── base.css                 # Base/reset styles
│   │   ├── components.css           # Reusable components
│   │   ├── layout.css               # Layout utilities
│   │   ├── sidebar.css              # Sidebar styles
│   │   ├── header.css               # Header styles
│   │   ├── modal.css                # Modal dialog styles
│   │   ├── tabs.css                 # Tab navigation styles
│   │   ├── responsive.css           # Responsive breakpoints
│   │   ├── settings.css             # Settings page styles
│   │   ├── dashboards.css           # Dashboard styles
│   │   ├── team-dashboard.css       # Public dashboard styles
│   │   └── ...                      # Additional style modules
│   ├── js/                          # JavaScript modules
│   │   ├── app.js                   # Main app initialization
│   │   ├── templates.js             # Template builder with canvas
│   │   ├── workspaces.js            # Workspace management
│   │   ├── teams.js                 # Team operations
│   │   ├── dashboards.js            # Dashboard operations
│   │   ├── settings.js              # User settings
│   │   ├── tabs.js                  # Tab navigation
│   │   ├── utils.js                 # Utility functions
│   │   ├── tutorial.js              # Interactive tutorial
│   │   ├── help.js                  # Help center
│   │   └── team-dashboard.js        # Public dashboard display
│   ├── templates/                   # HTML templates
│   │   ├── application.html         # Job application form
│   │   ├── team-dashboard.html      # Public team dashboard
│   │   ├── deo-jobs.html            # Public jobs board
│   │   └── error.html               # Error pages
│   ├── sections/                    # Reusable template sections
│   │   ├── sidebar.html             # Main sidebar
│   │   ├── header.html              # Header
│   │   └── content.html             # Content area
│   └── views/                       # Individual view components
│       ├── home.html                # Home/dashboard view
│       ├── templates.html           # Templates view
│       ├── workspaces.html          # Workspaces view
│       ├── teams.html               # Teams view
│       ├── dashboards.html          # Dashboards view
│       └── settings.html            # Settings view
│
└── tests/                           # Test suite
```

---

## Installation

### Prerequisites

- Python 3.11 or higher
- MongoDB Atlas account or local MongoDB instance
- Google Cloud Console project (for OAuth)
- Slack workspace with admin access
- Slack bot token with required scopes

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/deo-orchestrator.git
cd deo-orchestrator

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Session Security
SESSION_SECRET=your-secure-session-secret-min-32-chars

# MongoDB Configuration
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority

# OAuth Redirect URI
REDIRECT_URI=http://localhost:8000/auth/callback

# Environment (development or production)
ENVIRONMENT=development
```

### Slack App Setup

1. Go to [Slack API Apps](https://api.slack.com/apps) and create a new app
2. Use the provided `manifest.json` or configure manually:

**Required Bot Token Scopes:**
- `channels:read` - View basic channel information
- `channels:history` - View messages in public channels
- `chat:write` - Send messages as the bot
- `users:read` - View users in the workspace
- `users:read.email` - View email addresses
- `im:write` - Start direct messages
- `im:history` - View direct message history
- `files:write` - Upload files

**Event Subscriptions:**
- Enable Events API
- Set Request URL to: `https://your-domain.com/slack/events`
- Subscribe to bot events:
  - `message.channels` - Messages in public channels
  - `message.im` - Direct messages

3. Install the app to your workspace and copy the Bot User OAuth Token

---

## Usage

### Running the Server

```bash
# Development with auto-reload
uvicorn main:app --reload --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

The server will start at: [http://localhost:8000](http://localhost:8000)

### Development Mode

In development mode (`ENVIRONMENT=development`):
- OAuth redirects use `http://localhost:8000`
- Static files have cache disabled
- Debug logging is enabled

---

## Architecture

### Backend Framework

- **FastAPI**: Async Python web framework with automatic OpenAPI documentation
- **Uvicorn**: ASGI server for running the application
- **Motor**: Async MongoDB driver for non-blocking database operations
- **APScheduler**: Background job scheduling for recurring templates
- **Authlib**: OAuth 2.0 client for Google authentication
- **Jinja2**: Template engine for HTML rendering
- **httpx**: Async HTTP client for Slack API calls

### Database Schema

**Database Name:** `deo`

| Collection | Description |
|------------|-------------|
| `accounts` | User accounts with Google OAuth profile data |
| `active_sessions` | Active user session tracking |
| `workspaces` | Workspace configurations with bot tokens |
| `templates` | Workflow templates with block configurations |
| `pending_executions` | In-progress template executions |
| `completed_executions` | Successfully finished executions |
| `failed_executions` | Failed execution logs with errors |
| `active_schedules` | Scheduled template configurations |
| `scheduled_executions_log` | History of scheduled runs |
| `teams` | Team information and member lists |
| `dashboard_templates` | Dashboard configurations |
| `dashboard_logins` | Dashboard access credentials |
| `dashboard_data` | Collected dashboard metrics |
| `tokens` | Saved Slack bot tokens per user |
| `application_forms` | Job application form templates |
| `feedback` | User feedback submissions |

### Frontend Technologies

- **Vanilla JavaScript**: No framework dependencies
- **CSS Custom Properties**: Theming with CSS variables
- **Responsive Design**: Mobile, tablet, and desktop breakpoints
- **Dark Theme**: Black/dark gray with purple accents
- **Glassmorphism**: Frosted glass UI effects
- **Canvas API**: Visual workflow builder with zoom/pan

---

## Core Modules

### Authentication (oauth.py)

Handles Google OAuth 2.0 authentication flow:
- Initiates OAuth login redirect
- Processes OAuth callback
- Creates/updates user accounts
- Manages session data

### Workspace Management (workspace.py)

Manages Slack workspace connections:
- Create workspaces with bot tokens
- List user's workspaces
- Validate workspace ownership

### Account Management (account.py)

User account operations:
- Save/retrieve Slack bot tokens
- Token masking for security
- Delete account with cascading data removal

### Template System (templates.py)

CRUD operations for workflow templates:
- Create templates with block configurations
- Update template settings and blocks
- Delete templates
- List user's templates
- Trigger template execution

### Orchestration Engine (orchestrate.py)

Core execution engine for templates:
- Graph-based block execution
- Context data passing between blocks
- Execution state tracking
- Error handling and logging
- Support for conditional branching

### Scheduler (scheduler.py)

APScheduler integration for recurring templates:
- Daily, weekly, monthly schedules
- One-time scheduled execution
- Custom interval scheduling
- Automatic template triggering
- Execution logging

### Team Management (teams.py)

Team collaboration features:
- Create teams with members
- Role management (owner, admin, member)
- Add/remove team members
- Update team details

### Dashboards (dashboards.py)

Metrics tracking dashboards:
- Create custom dashboards
- Define tracked metrics
- Team member data submission
- Weekly/monthly reporting periods
- Public dashboard access

### Job Applications (applications.py)

Job application form system:
- Create application forms
- Custom form fields
- Public form access
- Slack notifications on submission
- DEO Jobs board integration

### Slack Events (endpoints.py)

Slack Events API handler:
- URL verification challenge
- Message event processing
- Await execution resumption
- Response pattern matching

---

## Workflow Blocks

### Trigger Block

Initiates workflow execution:
- **Schedule**: Cron-based scheduling (daily, weekly, monthly)
- **Webhook**: HTTP trigger for external integrations
- **Manual**: User-initiated execution

### Message Block

Sends messages to Slack:
- Channel messages
- Direct messages to users
- Rich text formatting
- Variable interpolation from context

### Await Block

Pauses execution waiting for response:
- Channel or DM monitoring
- Timeout configuration
- Response matching (contains, equals, regex)
- Case-sensitive matching option
- Stores response in execution context

### Condition Block

Conditional branching logic:
- Evaluate context data
- Multiple condition types
- True/false execution paths
- Nested condition support

### Scan Block

Continuous channel monitoring:
- Watch for specific commands
- Pattern matching
- Trigger actions on match
- Background monitoring loop

### Response Block

Sends conditional responses:
- Based on previous block results
- Dynamic message content
- Channel or DM targeting

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/login` | Initiate Google OAuth login |
| GET | `/auth/callback` | OAuth callback handler |

### Account Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/account/tokens` | Get saved Slack tokens |
| POST | `/account/tokens` | Save new Slack token |
| DELETE | `/account/tokens/{token_id}` | Delete a saved token |
| DELETE | `/account/delete-all` | Delete account and all data |

### Workspace Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspace/list` | List user's workspaces |
| POST | `/workspace/create` | Create new workspace |

### Template Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/templates/create` | Create new template |
| GET | `/templates/{template_id}` | Get template details |
| PUT | `/templates/{template_id}` | Update template |
| DELETE | `/templates/{template_id}` | Delete template |
| POST | `/templates/{template_id}/execute` | Execute template |
| POST | `/templates/{template_id}/schedule` | Schedule template |
| GET | `/templates/{template_id}/executions` | Get execution history |
| POST | `/templates/{template_id}/stop` | Stop running execution |

### Team Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams/create` | Create new team |
| GET | `/teams` | List user's teams |
| GET | `/teams/{team_id}` | Get team details |
| PUT | `/teams/{team_id}` | Update team |
| DELETE | `/teams/{team_id}` | Delete team |
| POST | `/teams/{team_id}/members` | Add team members |
| DELETE | `/teams/{team_id}/members/{email}` | Remove team member |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/dashboards/create` | Create dashboard |
| GET | `/dashboards/{dashboard_id}` | Get dashboard |
| PUT | `/dashboards/{dashboard_id}` | Update dashboard |
| DELETE | `/dashboards/{dashboard_id}` | Delete dashboard |
| POST | `/dashboards/{dashboard_id}/metrics` | Submit metrics |
| GET | `/team-dashboard/{dashboard_id}` | Public dashboard view |

### Application Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/applications/create` | Create application form |
| GET | `/applications/{form_id}` | Get form details |
| PUT | `/applications/{form_id}` | Update form |
| DELETE | `/applications/{form_id}` | Delete form |
| POST | `/application/{form_id}` | Submit application (public) |
| GET | `/applications/{form_id}/submissions` | Get submissions |
| GET | `/get/deo-jobs` | Public DEO Jobs board |

### Slack Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send-message` | Send message to Slack |
| POST | `/get-channels` | List Slack channels |
| POST | `/get-users` | List workspace users |
| POST | `/slack/events` | Slack Events webhook |

### Feedback Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/feedback` | Submit user feedback |

---

## Deployment

### Docker

Build and run with Docker:

```bash
# Build the image
docker build -t deo-orchestrator .

# Run the container
docker run -p 8000:8000 --env-file .env deo-orchestrator
```

**Dockerfile configuration:**
- Base image: Python 3.11
- Exposed port: 8000
- Entry command: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Fly.io

Deploy to Fly.io:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy
```

**fly.toml configuration:**
- App name: `deo-orchestrator`
- Region: `sjc` (San Jose)
- HTTP service on port 8000
- Minimum 2 machines for high availability
- Force HTTPS enabled
- Shared CPU with 1 GB RAM

### Vercel

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**vercel.json configuration:**
- Python runtime support
- All routes directed to main.py
- Serverless function deployment

---

## Troubleshooting

### MongoDB Connection Issues

- Verify IP whitelist in MongoDB Atlas (add `0.0.0.0/0` for testing)
- Check connection string format and credentials
- Disable VPN/firewall if blocking connections
- Ensure `certifi` package is installed for SSL

### Slack Integration Issues

- Verify bot is added to the target channel
- Check bot token has required scopes
- Ensure Events API URL is correctly configured
- Verify the app is installed to the workspace

### OAuth Issues

- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check `REDIRECT_URI` matches Google Console configuration
- Verify authorized redirect URIs in Google Cloud Console

### Template Execution Issues

- Check execution logs in `pending_executions` and `failed_executions` collections
- Verify workspace bot token is valid
- Ensure target channels/users exist
- Check await timeout settings

### Scheduler Issues

- Verify scheduler is running (check startup logs)
- Check `active_schedules` collection for configuration
- Review `scheduled_executions_log` for errors

---

## License

NA

---

## Support

For issues and feature requests, please open an issue on GitHub or contact the development team.

Website: [https://godeo.app](https://godeo.app)
