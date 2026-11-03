# IRIS — Intelligent Retrieval & Insight System

IRIS is an AI-powered document assistant that allows users to upload documents, ask questions, retrieve relevant information, and interact with an AI assistant.

## Features

- Upload PDF, DOCX, and TXT documents.
- Ask questions based on uploaded documents.
- Retrieve relevant document chunks using BM25.
- Generate AI-powered answers using Groq.
- Display document sources and page references.
- Smart Assistant for general conversations.
- Optional web search using Tavily.
- User authentication with email OTP verification.
- User profile and account management.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- PyMuPDF
- python-docx
- BM25
- Groq API
- Tavily API

## Prerequisites

Install the following before running IRIS:

- Python 3.10 or newer
- Node.js 20.19+ (Node.js 24 recommended)
- npm
- Git

## 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd IRIS
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the repository URL.

## 2. Backend Setup

Open a terminal:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Configure Environment Variables

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Open `backend/.env` and configure your credentials:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-email@gmail.com
SMTP_APP_PASSWORD=your-gmail-app-password

GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-120b

TAVILY_API_KEY=your-tavily-api-key
```

Required credentials:
- SMTP email and Gmail App Password for email OTP functionality.
- Groq API key for AI-powered responses.
- Tavily API key for web search functionality.

Keep your actual `.env` file private. Never commit API keys or passwords to GitHub.

### Initialize and Run Backend

Create the database directory if it does not exist:

```bash
python -c "from pathlib import Path; Path('data').mkdir(exist_ok=True)"
```

Start the FastAPI server:

```bash
python -m uvicorn app.main:app --reload
```

Backend URL:

http://localhost:8000

API documentation:

http://localhost:8000/docs

Health check:

http://localhost:8000/health

The application creates missing database tables during startup.

## 3. Frontend Setup

Open a second terminal from the project root:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Frontend URL:

http://localhost:5173

The frontend uses `http://localhost:8000` as its default backend URL.

## 4. Running Both Servers

Keep both terminals running:

| Service | Command | URL |
|---|---|---|
| Backend | `python -m uvicorn app.main:app --reload` | http://localhost:8000 |
| Frontend | `npm run dev` | http://localhost:5173 |

## 5. Running Tests

From the backend directory, with the virtual environment activated:

```bash
python -m pytest
```

## 6. Production Build

From the frontend directory:

```bash
npm run build
```

## Project Structure

```text
IRIS/
├── backend/
│   ├── app/
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── document_service.py
│   │   ├── rag_service.py
│   │   ├── retrieval_service.py
│   │   └── main.py
│   ├── data/
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## Important Notes

- Each developer must configure their own API keys.
- The SQLite database is local and is not included in the repository.
- Uploaded documents and local user data are not shared through GitHub.
- Do not upload `.env` files, API keys, passwords, or private databases.
- Keep the backend and frontend servers running while using the application.

## Team

**IRIS — Intelligent Retrieval & Insight System**

Developed by:
- Abdullah
- Ajeet
- Naushaba
