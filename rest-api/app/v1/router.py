from fastapi import APIRouter
from app.v1.model_router import get_router
from app.models.user import User
from app.models.cars import Car

api_router = APIRouter()
api_router.include_router(get_router(User), prefix="/users", tags=["users"])
api_router.include_router(get_router(Car), prefix="/cars", tags=["cars"])

