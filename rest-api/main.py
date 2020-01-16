from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.v1.router import api_router


app = FastAPI(title="API Demo", openapi_url="/api/v1/openapi.json")
# app = FastAPI(title="Test")

# CORS
origins = ["*"]

# Set all CORS enabled origins
# if config.BACKEND_CORS_ORIGINS:
#     origins_raw = config.BACKEND_CORS_ORIGINS.split(",")
#     for origin in origins_raw:
#         use_origin = origin.strip()
#         origins.append(use_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.include_router(api_router, prefix=config.API_V1_STR)
app.include_router(api_router, prefix="/api/v1")


