from redis import Redis
from redis.asyncio import Redis as AsyncRedis

from app.config import settings


redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
async_redis_client = AsyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
