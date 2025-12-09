import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
import certifi
import asyncio
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Global variables
mongo_client = None
database = None

# Load from environment
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = "deo"


async def connect_to_mongo():
    """Establish connection to MongoDB Atlas."""
    global mongo_client, database
    try:
        mongo_client = AsyncIOMotorClient(
            MONGODB_URL,
            server_api=ServerApi('1'),
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            retryWrites=True,
            retryReads=True
        )

        await asyncio.wait_for(
            mongo_client.admin.command('ping'),
            timeout=30.0
        )

        database = mongo_client[DATABASE_NAME]

        logger.info("Successfully connected to MongoDB!")
        print("Successfully connected to MongoDB!")
        return True

    except asyncio.TimeoutError:
        logger.error("MongoDB connection timeout")
        print("MongoDB connection timeout")
        return False
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        print(f"Could not connect to MongoDB: {e}")
        return False


async def close_mongo_connection():
    """Close the MongoDB connection."""
    global mongo_client
    if mongo_client:
        mongo_client.close()
        logger.info("MongoDB connection closed")
        print("MongoDB connection closed")


def get_database():
    """Get the database instance."""
    global database
    return database


def is_connected():
    """Check if database is connected."""
    global database
    return database is not None


def get_collection(collection_name: str):
    """Get a MongoDB collection by name."""
    global database
    if database is None:
        raise RuntimeError("Database not connected. Call connect_to_mongo() first.")
    return database[collection_name]