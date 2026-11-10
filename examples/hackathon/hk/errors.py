"""실패 상태 계약. 상태 코드와 화면에 보여줄 내용을 한곳에서 정한다(references/failure-states.md)."""


class AppError(Exception):
    status = 500
    code = "server_error"

    def __init__(self, message: str, **detail):
        super().__init__(message)
        self.message = message
        self.detail = detail

    def body(self) -> dict:
        return {"error": self.code, "message": self.message, **self.detail}


class Unauthorized(AppError):
    status, code = 401, "unauthorized"


class Forbidden(AppError):
    status, code = 403, "forbidden"


class NotFound(AppError):
    status, code = 404, "not_found"


class Invalid(AppError):
    """422: 어느 칸이 왜 틀렸는지. fields={"cost": "0보다 커야 합니다"}"""

    status, code = 422, "invalid_input"

    def __init__(self, fields: dict[str, str]):
        super().__init__("입력값을 확인해 주세요", fields=fields)


class Conflict(AppError):
    status, code = 409, "conflict"


SERVER_ERROR_BODY = {"error": "server_error", "message": "잠시 후 다시 시도해 주세요"}
