from flask_sqlalchemy import SQLAlchemy
from celery import Celery
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config.settings import settings

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
    default_limits=[]
)

def make_celery(app_name=__name__):
    celery = Celery(
        app_name,
        backend=settings.REDIS_URL,
        broker=settings.REDIS_URL,
        include=['app.tasks.processing', 'app.tasks.memory_tasks', 'app.tasks.videomix_tasks']
    )
    return celery

celery_app = make_celery("rag_worker")
