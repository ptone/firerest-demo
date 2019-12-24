import sys
import uuid

from datetime import datetime
from typing import List
from fastapi import HTTPException


from pydantic import BaseModel
from google.cloud import firestore

class ModelStorage:
    def __init__(self, db=None, kind=None):
        if db is not None:
            self._db = db
        else:
            self._db = firestore.Client()
        self._cls = kind
    
    def get_collection(self, model_instance):
        return self._db.collection(model_instance.__class__.__name__.lower())

    def save(self, model_instance):
        if self._cls is not None and model_instance.__class__ != self._cls:
            raise(ValueError("Provided class does not meet the storage type"))
        print("saving ", model_instance.id)
        if model_instance.id is None:
            model_instance.id = uuid.uuid4().hex
        # else check if it exists and 404?
        self._db.collection(model_instance.__class__.__name__).document(model_instance.id).set(model_instance.dict())
        return model_instance
    
    def get(self, id, kind=None):
        if self._cls is None and kind is None:
            raise RuntimeError("Model kind was not provided at initialization or with get")
        kind  = kind or self._cls
        doc = self._db.collection(kind.__name__).document(id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Item not found")
        return kind(**doc.to_dict())
    
    def delete(self, id, kind=None):
        if self._cls is None and kind is None:
            raise RuntimeError("Model kind was not provided at initialization or with get")
        kind  = kind or self._cls
        doc = self._db.collection(kind.__name__).document(id)
        if not doc.get().exists:
            raise HTTPException(status_code=404, detail="Item not found")
        doc.delete()
        return

    def query(self, query={}, _limit=100, kind=None):
        if self._cls is None and kind is None:
            raise RuntimeError("Model kind was not provided at initialization or with get")
        ref = self._db.collection(kind.__name__)
        reserved = ["_limit", "_order"]
        castable_types = {
            "string": str,
            "integer": int
        }
        for k, v in query.items():
            field = k
            if field in reserved:
                continue
            op, val = parse_query(v)

            valType = kind.schema()['properties'][field]['type']
            if valType in castable_types:
                val = castable_types[valType](val)


            ref = ref.where(field, op, val)
        ref = ref.limit(int(_limit))
        # return full result as array
        result = [d.to_dict() for d in ref.stream()]
        return result

def parse_query(encoded):
    encoded_ops = {
        "gt": ">",
        "lt": "<",
        "gte": ">=",
        "lte": "<=",
        "ac": "array_contains"
        }
    op = "=="
    if len(encoded) > 1:
        raise NotImplementedError("Multi args not supported")
    encoded = encoded[0]
    if '~' in encoded:
        # the value has an operator
        op, val = encoded.split("~")
        if op in encoded_ops:
            op = encoded_ops[op]
        else:
            raise RuntimeError("Invalid query operator")
        return op, val
    else:
        val = encoded
    return op, val

db = None

def get_default():
    global db
    if db is None:
        db = ModelStorage()
    return db