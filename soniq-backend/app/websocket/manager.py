from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, job_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[job_id] = websocket

    def disconnect(self, job_id: str) -> None:
        self.active_connections.pop(job_id, None)

    async def send_progress(self, job_id: str, percent: int, stage: str) -> None:
        ws = self.active_connections.get(job_id)
        if ws:
            await ws.send_json({"type": "progress", "percent": percent, "stage": stage})

    async def send_result(self, job_id: str, result: dict) -> None:
        ws = self.active_connections.get(job_id)
        if ws:
            await ws.send_json({"type": "result", "data": result})
            await ws.close()
            self.disconnect(job_id)

    async def send_error(self, job_id: str, message: str) -> None:
        ws = self.active_connections.get(job_id)
        if ws:
            await ws.send_json({"type": "error", "message": message})
            await ws.close()
            self.disconnect(job_id)


manager = WebSocketManager()
