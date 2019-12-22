from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder


from starlette.requests import Request


import app.storage

def get_router(endpoint_model):
    router = APIRouter()
    db = app.storage.get_default()


    @router.get("/", response_model=List[endpoint_model])
    def list_items(request: Request, _limit: int = 100):
        q = request.query_params.items()
        objects = db.query(query=q, kind=endpoint_model, _limit=_limit)
        return objects

    @router.post("/", response_model=endpoint_model)
    def create_item(obj: endpoint_model):
        # should this error if exists?
        new_obj = db.save(obj)
        return new_obj

    @router.get("/{id}", response_model=endpoint_model)
    def read_item(id: str, request: Request):
        obj = db.get(id, kind=endpoint_model)
        return obj

    @router.delete("/{id}")
    def delete_item(id: str):
        db.delete(id, kind=endpoint_model)
        return {"result": "ok"}
        
    return router