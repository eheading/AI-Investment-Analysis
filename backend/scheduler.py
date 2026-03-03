import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from config import get_settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def scheduled_summary_job():
    """Hourly job to collect data and generate AI summary"""
    logger.info("Starting scheduled summary generation...")
    try:
        from ai.summary_engine import generate_summary
        result = await generate_summary()
        logger.info(f"Summary generated successfully: ID={result.get('id', 'unknown')}")
    except Exception as e:
        logger.error(f"Scheduled summary generation failed: {e}", exc_info=True)

def start_scheduler():
    """Initialize and start the scheduler"""
    settings = get_settings()
    interval = settings.summary_interval_minutes

    scheduler.add_job(
        scheduled_summary_job,
        trigger=IntervalTrigger(minutes=interval),
        id="summary_generation",
        name="Generate AI Market Summary",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started. Summary generation every {interval} minutes.")

def stop_scheduler():
    """Stop the scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped.")
