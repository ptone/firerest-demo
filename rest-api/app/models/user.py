from typing import Optional
from datetime import datetime
from typing import List
from pydantic import BaseModel

class User(BaseModel):
    id: Optional[str] = None
    first = 'John'
    last = 'Doe'
    # signup_ts: datetime = None
    # friends: List[int] = []


    # @property
    # def fullname(self):
    #     return '{} {}'.format(self.first, self.last)

