from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
# from pydantic.types import EmailStr
# from sqlalchemy.orm import Session


from starlette.requests import Request


import app.storage

# from app import crud
# from app.api.utils.db import get_db
# from app.api.utils.security import get_current_active_superuser, get_current_active_user
# from app.core import config
# from app.db_models.user import User as DBUser
from app.models.user import User
# from app.utils import send_new_account_email

router = APIRouter()
db = app.storage.get_default()

endpoint_model = User

@router.get("/", response_model=List[endpoint_model])
def read_users(request: Request, limit: int = 100):
    """
    Retrieve users.
    """
    print(request.query_params.items())
    # for k, v in request.query_params:
    #     print(k, v)
    q = request.query_params.items()
    print(q)
    users = db.query(query=q, kind=endpoint_model, limit=limit)
    return users

@router.post("/")
def create_user(obj: endpoint_model, response_model=endpoint_model):
    # create user - error if exists
    new_obj = db.save(obj)
    return new_obj

@router.get("/{id}", response_model=endpoint_model)
def read_item(id: str, request: Request):
    print(request.query_params)
    obj = db.get(id, kind=endpoint_model)
    return obj