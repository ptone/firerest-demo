from typing import Optional
from typing import List
from pydantic import BaseModel

class Car(BaseModel):
    id: Optional[str] = None
    make: str = ''
    model: str = ''
    year: int
    body_styles: List[str] = []

