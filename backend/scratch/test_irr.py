import asyncio
from src.db.session import async_session
from src.api.routes.irrigation import get_irrigation_status

async def test():
    async with async_session() as db:
        try:
            res = await get_irrigation_status(2, db)
            print("Success:", res)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
