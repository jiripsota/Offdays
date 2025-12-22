import aiosmtplib
from email.message import EmailMessage
from app.config import settings

async def send_email(to_email: str, subject: str, content: str):
    """
    Send an email asynchronously using SMTP settings from config.
    """
    if not settings.smtp_host or not settings.smtp_port:
        print(f"⚠️ SMTP not configured. Skipping email to {to_email}")
        return

    message = EmailMessage()
    message["From"] = settings.emails_from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(content)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=True if settings.smtp_port == 465 else False,
            start_tls=True if settings.smtp_port == 587 else False,
        )
        print(f"📧 Email sent to {to_email}: {subject}")
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")

async def send_new_request_email(to_email: str, requester_name: str, start_date: str, end_date: str, days: float):
    subject = f"New Leave Request: {requester_name}"
    content = f"""
    Hello,

    {requester_name} has requested a new leave.

    Dates: {start_date} to {end_date}
    Days: {days}

    Please log in to Offdays to approve or reject this request.

    Best regards,
    Offdays Team
    """
    await send_email(to_email, subject, content)

async def send_status_update_email(to_email: str, status: str, start_date: str, end_date: str):
    subject = f"Leave Request {status.title()}"
    content = f"""
    Hello,

    Your leave request for {start_date} to {end_date} has been {status.upper()}.

    Best regards,
    Offdays Team
    """
    await send_email(to_email, subject, content)
