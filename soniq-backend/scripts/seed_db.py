import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "demo@soniq.local"))
        user = result.scalar_one_or_none()
        if user:
            print("Demo user already exists")
            return

        user = User(display_name="Demo User", email="demo@soniq.local")
        db.add(user)
        await db.commit()
        print("Seeded demo user")


if __name__ == "__main__":
    asyncio.run(main())
