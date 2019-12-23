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
    
    list_items.__doc__ = """
    List {kind}s
    
    **Supports query via query string:**

    `?[field]=[value]`

    Multiple fields can be added.

    Equality operator is the default, for other operators they are encoded in the value separated by a `~`:

    `?[field]=[op]~[value]`

    Operators supported are:

    | Operator | Encoding | Meaning |
    | -- | -- | -- |
    | == | _none; default_ | Equality |
    | > | gt | Greater Than |
    | < | lt | Less Than |
    | >= | gte | Greater Than or Equal |
    | <= | lte | Less Than or Equal |
    | array_contains | ac | for fields that are arrays, return only items where the field contains value |
 
    **Examples**

    all {kind}s where foo == bar:  `?foo=bar`

   {kind}s where year greater than 2018 and features is an array that contains 'tall'

   `?year=gt~2018&features=ac~tall`
    
    """.format(kind=endpoint_model.__name__.lower())

    @router.post("/", response_model=endpoint_model)
    def create_item(obj: endpoint_model):
        """
        Create an item given an filled version of the model

        **NOTE** id should be empty on post
        """
        # should this error if exists?
        new_obj = db.save(obj)
        return new_obj

    @router.get("/{id}", response_model=endpoint_model)
    def read_item(id: str, request: Request):
        """
        Get an Item by ID
        """
        obj = db.get(id, kind=endpoint_model)
        return obj

    @router.delete("/{id}")
    def delete_item(id: str):
        """
        Delete an item given the ID
        """
        db.delete(id, kind=endpoint_model)
        return {"result": "ok"}
        
    return router