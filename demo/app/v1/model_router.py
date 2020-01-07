import sys
from typing import List
import urllib.parse
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from starlette.requests import Request
import logging
import app.storage

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.DEBUG)
if __name__ != '__main__':
    gunicorn_logger = logging.getLogger('gunicorn.error')
    logger.handlers = gunicorn_logger.handlers
    logger.setLevel(gunicorn_logger.level)
    



def get_router(endpoint_model):
    router = APIRouter()
    db = app.storage.get_default()


    @router.get("", response_model=List[endpoint_model])
    def list_items(request: Request, q: str = "", limit: int = 100):
 
        # parse the query into a list of (k, v) pairs where v is still the encoded form with op~val
        # this form is decoded in the storage query layer
        try:
            if q != "":
                q = [(i.split("=")[0], i.split("=")[1]) for i in q.split(",") ]
            else:
                q = []
        except Exception as e:
            raise HTTPException(status_code=400, detail="malformed query")
        objects = db.query(query=q, kind=endpoint_model, limit=limit)
        logger.debug(request.headers)
        return objects
    
    list_items.__doc__ = """
    List {kind}s
    
    **Supports queries**

    `?q=[field]=[value],...`

    Multiple statements supported comma delimited.

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
 
    Number or results returned can be limited with a limit querystring param

    **Examples**

    all {kind}s where foo == bar:  `?q=foo=bar`

   3 {kind}s where year greater than 2018 and features is an array that contains 'tall'

   `?q=year=gt~2018,features=ac~tall&limit=3`
    
    """.format(kind=endpoint_model.__name__.lower())

    @router.post("", response_model=endpoint_model)
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