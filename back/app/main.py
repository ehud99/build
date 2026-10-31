"""La API de Real. Correr con `uvicorn app.main:app --port 8020 --reload` desde `back/`."""
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.errors import ApiError, api_error_handler, validation_error_handler
from app.modules.auth.router import router as auth_router
from app.modules.finance.router import router as finance_router
from app.modules.goals.router import router as goals_router
from app.modules.notes.router import router as notes_router

app = FastAPI(title="Real", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

app.include_router(auth_router)
app.include_router(goals_router)
app.include_router(notes_router)
app.include_router(finance_router)


@app.get("/api/health")
def health():
    return {"ok": True}
