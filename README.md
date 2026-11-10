# NEXORA AI

**Intelligence in Motion. Agents in Action.**

NEXORA AI is an enterprise-style workspace for the LangGraph agents in this repository. It connects to the existing LangGraph API and presents registered assistants, streamed runs, thread state, and supported human-in-the-loop interrupts without replacing the original agent implementations.

## Introduction
This repository contains the NEXORA AI frontend alongside the original hands-on tutorials for learning LangChain, LangGraph, and Deep Agents, organized into two learning tracks:

- **101**: Fundamentals of building agents with LangChain and LangGraph
- **201**: Advanced patterns including multi-agent systems, deep agents, and production workflows

To understand how these frameworks relate to each other, see [LangChain vs LangGraph vs Deep Agents](https://docs.langchain.com/oss/python/concepts/products).

This is a condensed version of LangChain Academy, intended to be run in a session with a LangChain engineer. If you're interested in going into more depth, or working through tutorials on your own, check out [LangChain Academy](https://academy.langchain.com/courses/intro-to-langgraph)! LangChain Academy has helpful pre-recorded videos from our LangChain engineers.

## NEXORA AI workspace

The React and TypeScript application lives in `frontend/`. It discovers assistants and threads from the LangGraph API, submits tasks to registered graphs, streams run events, inspects thread state, and resumes reported interrupts. It connects directly to live agents without mock execution data.

### 3D WebGL Integration

The application features two bespoke GPU-accelerated WebGL components:

1. **`CorollaGleam`** (`frontend/src/components/3d/CorollaGleam.tsx`):
   - Parametric 3D fluted corolla torus rendered with high-precision custom WebGL shaders.
   - Real thin-film optical path interference, spectral dispersion, and dual-lobe Blinn-Phong/diamond gleam specular highlights.
   - Pointer-following lerp inertia tracking, continuous ambient rotation, automatic WebGL context loss recovery, and accessibility-first `prefers-reduced-motion` compliance.
   - Embedded prominently in the Landing Page hero, application header/footer, Dashboard emblem, Command Center, and Workflows toolbar.

2. **`FoldingParticleShell`** (`frontend/src/components/3d/FoldingParticleShell.tsx`):
   - Over 3,200 particle vertices distributed across a 3D spherical Fibonacci lattice.
   - Real-time multi-harmonic wave folding equations (`sin(theta * freq + time) * cos(...)`) computed per-frame.
   - Pointer magnetic warp distortion, camera-distance depth extinction, and additive alpha blending (`gl.ONE, gl.ONE`).
   - Integrated via `Nexora3DEnvironment` as a persistent, non-blocking (`pointer-events: none`) ambient background across all application views.

### Document Intelligence Workspace (`/app/documents`)

- Native drag-and-drop file ingestion supporting PDF, TXT, Markdown, JSON, and CSV files (up to 25 MB).
- One-click sample operations brief preloader (`NEXORA_AI_Sample_Operations_Brief.pdf`).
- Client-side document parser with character count, estimated LLM token metrics, and instant full-text preview.
- Direct dispatch to any registered LangGraph agent with pre-configured analysis presets (Executive Summary, Risk & Compliance, Strategic Action Plan, Technical Extraction).
- Live streaming agent execution with instant Markdown, TXT, JSON, and formatted browser print/PDF export options.

### Google OAuth 2.0 Authentication

- Official Google Sign-In button with high-contrast Obsidian UI styling.
- Secure PKCE/Implicit OAuth 2.0 flow configured for Google Identity Services.
- OAuth redirect and callback handling via `/auth/callback`.
- Local session persistence with decoded JWT user profile display (name, email, avatar).
- Backend token verification endpoint in `utils/auth.py` validating Google JWKS signatures, audience (`aud`), issuer (`iss`), and expiration (`exp`).

### Run locally on Windows

Open two PowerShell terminals from the repository root.

**Terminal 1 — configure and start the original LangGraph server:**

```powershell
Copy-Item .env.example .env
# Edit .env and provide ANTHROPIC_API_KEY and TAVILY_API_KEY.
uv sync
uv run langgraph dev
```

`ANTHROPIC_API_KEY` is required by the current default in `utils/models.py`. `TAVILY_API_KEY` is used by the Deep Agent web-search tool. Other integrations require their own provider credentials as configured by the existing project.

**Terminal 2 — start the NEXORA AI frontend:**

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. During Vite development, `/langgraph-api` is proxied to `http://127.0.0.1:2024`. For another deployment, set `VITE_LANGGRAPH_API_URL` in the frontend environment to its API URL; configure deployment CORS/authentication at the server or trusted reverse proxy. Never place provider secrets in frontend variables.

Build the production frontend with:

```powershell
npm run build
```

Preview the built frontend locally with:

```powershell
npm run preview
```

Run the browser checks from `frontend/` after starting the LangGraph server in Terminal 1:

```powershell
npx playwright install chromium
npm run test:e2e
```

The end-to-end suite visits every workspace route, checks responsive navigation and preferences, and confirms the real 9-graph registry. It does not submit model tasks; those require valid provider credentials.

### Integration boundaries

- The original registry in `langgraph.json` remains the source of registered graphs.
- The dashboard and agent directory use live assistants and threads; the generic LangGraph API does not expose all product metrics or a separate execution archive.
- Approval actions are offered only for interrupts found in recent thread state. A graph must be configured to interrupt before approval/resume can be used.
- The Deep Agent uses LangGraph `StoreBackend` for `/memories/`; generic thread endpoints do not expose a memory browser here. Inspect that store through LangGraph Studio or a separately authenticated store integration.
- No application authentication service exists in the source repository. Protect a deployed API with the authentication mechanism of its host rather than presenting a client-side mock sign-in.
- Markdown, TXT, and JSON exports use fetched thread state. “Print / save as PDF” opens the browser print dialog.

## What's Inside

### 101 - Fundamentals (`notebooks/101/`)
- **101_langchain_langgraph.ipynb**: Build your first agent with models, tools, memory, and streaming
- **102_middleware.ipynb**: Middleware, human-in-the-loop patterns, and guardrails

### 201 - Production Patterns (`notebooks/201/`)
- **email_agent.ipynb**: Build a stateful email triage and response agent
- **multi_agent.ipynb**: Multi-agent systems with supervisors and specialized sub-agents
- **research_agent.ipynb**: Deep research agent with parallel sub-researchers
- **deepagents.ipynb**: Build a research agent from scratch with DeepAgents -- covers AGENTS.md, skills, backends, long-term memory, HITL, and more

### Agents (`agents/`)
Standalone agent implementations that run in LangGraph Studio via `langgraph dev`:
- **`agents/101/`** - Simple weather agent from the 101 notebook
- **`agents/email_agent/`** - Email triage agent
- **`agents/music_store/`** - Multi-agent music store (supervisor + subagents)
- **`agents/researcher/`** - Deep research agent with parallel sub-researchers
- **`agents/deep_agent/`** - DeepAgents research agent with AGENTS.md, skills (LinkedIn post, Twitter/X post), long-term memory, and HITL

All notebooks use the latest **LangChain**, **LangGraph**, and **DeepAgents** primitives, including `create_agent()`, `create_deep_agent()`, middleware, and interrupt patterns.

## Project Structure

```
langgraph-101/
├── notebooks/
│   ├── 101/                          # Fundamentals
│   │   ├── 101_langchain_langgraph.ipynb
│   │   └── 102_middleware.ipynb
│   └── 201/                          # Production Patterns
│       └── deep_agents.ipynb
│       ├── email_agent.ipynb
│       ├── multi_agent.ipynb
│       ├── research_agent.ipynb

├── agents/                           # Standalone agents for LangGraph Studio
│   ├── 101/agent.py
│   ├── email_agent/graph.py
│   ├── music_store/                  # Multi-agent supervisor + subagents
│   ├── researcher/                   # Deep research agent
│   └── deep_agent/                   # DeepAgents research agent
│       ├── agent.py                  # Agent definition
│       ├── AGENTS.md                 # Agent identity & instructions
│       └── skills/                   # On-demand capabilities
│           ├── linkedin-post/SKILL.md
│           └── twitter-post/SKILL.md
├── utils/
│   ├── models.py                     # Centralized model configuration
│   └── utils.py                      # Shared utilities
├── langgraph.json                    # Agent registry for langgraph dev
└── .env                              # API keys (not committed)
```

## Context

At LangChain, we aim to make it easy to build LLM applications. One type of LLM application you can build is an agent. There's a lot of excitement around building agents because they can automate a wide range of tasks that were previously impossible. 

In practice though, it is incredibly difficult to build systems that reliably execute on these tasks. As we've worked with our users to put agents into production, we've learned that more control is often necessary. You might need an agent to always call a specific tool first or use different prompts based on its state.

To tackle this problem, we've built [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) — a framework for building agent and multi-agent applications. Separate from the LangChain package, LangGraph's core design philosophy is to help developers add better precision and control into agent workflows, suitable for the complexity of real-world systems.

For complex, multi-step tasks that require planning, filesystem access, and delegation, we've built [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) — an agent harness on top of LangGraph that provides built-in tools, context management, and skills out of the box.

## Pre-work

### Clone the LangGraph 101 repo
```
git clone https://github.com/langchain-ai/langgraph-101.git
```


### Create an environment 
Ensure you have a recent version of pip and python installed
```
$ cd langgraph-101
# Copy the .env.example file to .env
cp .env.example .env
```
If you run into issues with setting up the python environment or acquiring the necessary API keys due to any restrictions (ex. corporate policy), contact your LangChain representative and we'll find a work-around!

### Package Installation
Ensure you have a recent version of pip and python installed
```
# Install uv if you haven't already
pip install uv

# Install the package, allowing for pre-release 
uv sync

# Activate the virtual environment
source .venv/bin/activate
```

### Running Agents Locally

You can run the agents in this repository locally using `langgraph dev`. This gives you:
- A local API server for your agents
- LangGraph Studio UI for testing and debugging
- Hot-reloading during development

```bash
# From the root directory, start the LangGraph development server
langgraph dev

# This will start a local server and provide:
# - API endpoint for your agents (typically http://localhost:2024)
# - LangGraph Studio UI link
```

The `langgraph.json` configuration file defines which agents are available. You can interact with agents via the API or through LangGraph Studio's visual interface.

For more details, see the [LangGraph CLI documentation](https://docs.langchain.com/langsmith/cli#langgraph-cli).

### Model Configuration

This repository uses a **centralized utils module** (`utils/`) to avoid code duplication. All model configurations and shared utilities are defined here:
- **`utils/models.py`** - LLM model initialization (OpenAI, Anthropic, Azure, Bedrock, Vertex AI)
- **`utils/utils.py`** - Shared utility functions (`show_graph`, `get_engine_for_chinook_db`)

**Default**: Anthropic with `claude-haiku-4-5`, as configured in `utils/models.py`. To switch providers, edit `utils/models.py` following the instructions below.

**Note**: Notebooks automatically add the project root to Python's path, so they can import from `utils` regardless of which subdirectory they're in.

### Azure OpenAI Instructions

If you are using Azure OpenAI instead of OpenAI, follow these steps:

1. **Set environment variables** in your `.env` file:
   ```
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_ENDPOINT=your_endpoint
   AZURE_OPENAI_API_VERSION=2024-03-01-preview
   ```

2. **Update `utils/models.py`**:
   - Comment out the "Default Models" section (lines 20-28)
   - Uncomment the "AZURE OpenAI Version" section (lines 31-57)
   - Configure the `azure_deployment` name to match your deployment

3. **Done!** All agents and notebooks will automatically use the Azure model

### AWS Bedrock Instructions

If you are using AWS Bedrock instead of OpenAI, follow these steps:

1. **Set environment variables** in your `.env` file:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION_NAME=us-east-1
   AWS_MODEL_ARN=your_model_arn
   ```

2. **Update `utils/models.py`**:
   - Comment out the "Default Models" section (lines 20-28)
   - Uncomment the "Bedrock Version" section (lines 60-78)
   - Configure the model settings as needed

3. **Done!** All agents and notebooks will automatically use the Bedrock model

### Google Vertex AI Instructions

If you are using Google Vertex AI instead of OpenAI, follow these steps:

1. **Set up Google Cloud credentials**
   - Create a service account in your Google Cloud project with Vertex AI permissions
   - Download the service account JSON key file
   - Save it as `vertexCred.json` in the project root directory

2. **Configure environment variables** in your `.env` file:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./vertexCred.json
   ```

3. **Update `utils/models.py`**:
   - Comment out the "Default Models" section (lines 20-28)
   - Uncomment the "Google Vertex AI version" section (lines 81-100)
   - The setup automatically handles credential paths using `Path(__file__)`

4. **Done!** All agents and notebooks will automatically use the Vertex AI model

**Note:** Make sure `vertexCred.json` is added to your `.gitignore` to avoid committing credentials.

## Getting Started

### Recommended Learning Path

1. **Start with 101** - `notebooks/101/`
   - Begin with `101_langchain_langgraph.ipynb` to learn LangChain + LangGraph fundamentals
   - Continue with `102_middleware.ipynb` for middleware and human-in-the-loop patterns

2. **Progress to 201** - `notebooks/201/`
   - Explore `email_agent.ipynb` for a complete stateful agent example
   - Build multi-agent systems with `multi_agent.ipynb`
   - Learn Deep Agents with `deepagents.ipynb` -- progressively build a research agent with AGENTS.md, skills, backends, memory, and HITL

3. **Run Agents in Studio**
   - Use `langgraph dev` to launch all agents in LangGraph Studio
   - Try the Deep Agent (`agents/deep_agent/`) -- ask it to research a topic and write a LinkedIn post

### Resources

- **[LangChain Documentation](https://docs.langchain.com/oss/python/langchain/overview)** - Complete LangChain reference
- **[LangGraph Documentation](https://docs.langchain.com/oss/python/langgraph/overview)** - LangGraph guides and API reference
- **[Deep Agents Documentation](https://docs.langchain.com/oss/python/deepagents/)** - Deep Agents harness reference
- **[LangChain vs LangGraph vs Deep Agents](https://docs.langchain.com/oss/python/concepts/products)** - How the frameworks relate
- **[LangChain Academy](https://academy.langchain.com/)** - Free courses with video tutorials
- **[LangSmith](https://smith.langchain.com)** - Debugging and monitoring for LLM applications
