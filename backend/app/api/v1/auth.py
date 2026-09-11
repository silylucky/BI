from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.jwt import DEFAULT_EXPIRES_MINUTES, create_access_token
from app.auth.login import service as login_service
from app.auth.models import get_meta_session
from app.auth.profile import service as profile_service
from app.auth.profile.schemas import ChangePasswordIn
from app.auth.users import service as user_service
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")
    expires_in: int = Field(serialization_alias="expiresIn")

    model_config = {"populate_by_name": True}


class DevSwitchRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(_db)]) -> LoginResponse | JSONResponse:
    try:
        user = login_service.authenticate(db, payload.username, payload.password)
    except login_service.LoginError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    token = create_access_token(
        str(user.id), user.username, token_version=user.token_version
    )
    return LoginResponse(
        access_token=token,
        expires_in=DEFAULT_EXPIRES_MINUTES * 60,
    )


def _profile_error_response(exc: profile_service.ProfileError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def change_password(
    payload: ChangePasswordIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> Response | JSONResponse:
    try:
        user_id = profile_service.resolve_actor_user_id(db, actor.id, actor.username)
        profile_service.change_password(
            db,
            user_id=user_id,
            actor_username=actor.username,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except profile_service.ProfileError as exc:
        return _profile_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dev-switch", response_model=LoginResponse)
def dev_switch(
    payload: DevSwitchRequest,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> LoginResponse | JSONResponse:
    if get_settings().vitalspan_env != "development":
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": "Not found", "detail": None},
        )
    try:
        user = user_service.get_user_by_username(db, payload.username)
    except OperationalError:
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": "Not found", "detail": None},
        )
    if user is None:
        return JSONResponse(
            status_code=404,
            content={"code": "USER_NOT_FOUND", "message": "用户不存在", "detail": None},
        )
    token = create_access_token(
        str(user.id), user.username, token_version=user.token_version
    )
    return LoginResponse(
        access_token=token,
        expires_in=DEFAULT_EXPIRES_MINUTES * 60,
    )
