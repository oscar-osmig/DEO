import asyncio
import httpx


async def run_template(template_id, name):
    start = asyncio.get_event_loop().time()
    print(f"[{name}] Starting at {start:.2f}s")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/templates/run",
            json={"template_id": template_id}
        )

    end = asyncio.get_event_loop().time()
    print(f"[{name}] Completed at {end:.2f}s (took {end - start:.2f}s)")
    return response.json()


async def main():
    results = await asyncio.gather(
        run_template("daily-standup", "Account 1"),
        run_template("user-dm-test", "Account 2"),
        run_template("daily-standup", "Account 3"),
    )
    print("\n✅ All completed!")


asyncio.run(main())