from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
from database.db import init_db
from routes import detect, history, analytics

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(title="SpotBot API", description="Autonomous PCB Defect Detection", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded/annotated images as static files → http://localhost:8000/uploads/filename.jpg
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

init_db()


app.include_router(detect.router,    prefix="/api/detect",    tags=["Detection"])
app.include_router(history.router,   prefix="/api/scans",     tags=["History"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

@app.get("/")
def root():
    return {"message": "SpotBot API is running 🤖", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
