"""
Celery tasks for notifications and alerts.
Handles email notifications, system alerts, and user communications.
"""
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

from app.celery_app import celery_app, ProgressTracker, handle_task_error, RETRY_CONFIG
from app.core.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, **RETRY_CONFIG)
def send_timetable_completion_notification(
    self,
    user_email: str,
    timetable_data: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send notification when timetable generation is completed.

    Args:
        self: Celery task instance
        user_email: Recipient email address
        timetable_data: Timetable generation results
        job_id: Optional job identifier

    Returns:
        Notification sending result
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 3)

    try:
        logger.info(f"Sending timetable completion notification job {job_id} to {user_email}")

        # Step 1: Prepare email content
        progress.update("Preparing notification content")

        subject = f"Timetable Generation Complete - {timetable_data.get('semester', 'Unknown Semester')}"

        # Generate HTML email content
        html_content = _generate_timetable_completion_html(timetable_data)
        text_content = _generate_timetable_completion_text(timetable_data)

        # Step 2: Send email
        progress.update("Sending email notification")

        email_result = _send_email(
            to_email=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

        # Step 3: Log notification
        progress.update("Logging notification")

        result = {
            "job_id": job_id,
            "notification_type": "timetable_completion",
            "recipient": user_email,
            "timetable_id": timetable_data.get("timetable_id"),
            "sent_at": datetime.now().isoformat(),
            "email_sent": email_result["success"],
            "status": "completed" if email_result["success"] else "failed",
            "error": email_result.get("error")
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Timetable completion notification")
        raise


@celery_app.task(bind=True, **RETRY_CONFIG)
def send_import_completion_notification(
    self,
    user_email: str,
    import_data: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send notification when bulk import is completed.

    Args:
        self: Celery task instance
        user_email: Recipient email address
        import_data: Import operation results
        job_id: Optional job identifier

    Returns:
        Notification sending result
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 3)

    try:
        logger.info(f"Sending import completion notification job {job_id} to {user_email}")

        # Step 1: Prepare content
        progress.update("Preparing import notification")

        import_type = import_data.get("type", "data")
        success_count = import_data.get("successful_imports", 0)
        total_count = import_data.get("total_processed", 0)

        subject = f"{import_type.title()} Import Complete - {success_count}/{total_count} Records Processed"

        html_content = _generate_import_completion_html(import_data)
        text_content = _generate_import_completion_text(import_data)

        # Step 2: Send notification
        progress.update("Sending import notification")

        email_result = _send_email(
            to_email=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

        # Step 3: Complete task
        progress.update("Finalizing import notification")

        result = {
            "job_id": job_id,
            "notification_type": "import_completion",
            "recipient": user_email,
            "import_type": import_type,
            "sent_at": datetime.now().isoformat(),
            "email_sent": email_result["success"],
            "status": "completed" if email_result["success"] else "failed"
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Import completion notification")
        raise


@celery_app.task(bind=True)
def send_system_alert(
    self,
    alert_type: str,
    alert_data: Dict[str, Any],
    recipients: List[str],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send system alerts to administrators.

    Args:
        self: Celery task instance
        alert_type: Type of alert (error, warning, info)
        alert_data: Alert details and context
        recipients: List of recipient email addresses
        job_id: Optional job identifier

    Returns:
        Alert sending results
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, len(recipients) + 1)

    try:
        logger.info(f"Sending system alert job {job_id} to {len(recipients)} recipients")

        # Step 1: Prepare alert content
        progress.update("Preparing system alert")

        subject = f"System Alert: {alert_type.title()} - {alert_data.get('title', 'System Notification')}"

        html_content = _generate_system_alert_html(alert_type, alert_data)
        text_content = _generate_system_alert_text(alert_type, alert_data)

        # Step 2+: Send to each recipient
        results = []

        for recipient in recipients:
            progress.update(f"Sending alert to {recipient}")

            email_result = _send_email(
                to_email=recipient,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                priority="high" if alert_type == "error" else "normal"
            )

            results.append({
                "recipient": recipient,
                "sent": email_result["success"],
                "error": email_result.get("error")
            })

        successful_sends = len([r for r in results if r["sent"]])

        result = {
            "job_id": job_id,
            "notification_type": "system_alert",
            "alert_type": alert_type,
            "recipients": len(recipients),
            "successful_sends": successful_sends,
            "failed_sends": len(recipients) - successful_sends,
            "results": results,
            "sent_at": datetime.now().isoformat(),
            "status": "completed" if successful_sends == len(recipients) else "partial_failure"
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "System alert")
        raise


@celery_app.task(bind=True, **RETRY_CONFIG)
def send_weekly_analytics_digest(
    self,
    institution_id: str,
    recipient_emails: List[str],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send weekly analytics digest to administrators.

    Args:
        self: Celery task instance
        institution_id: Institution UUID
        recipient_emails: List of recipient email addresses
        job_id: Optional job identifier

    Returns:
        Digest sending results
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 4)

    try:
        logger.info(f"Sending weekly analytics digest job {job_id} for institution {institution_id}")

        # Step 1: Gather analytics data
        progress.update("Gathering weekly analytics")

        # This would typically call analytics tasks or fetch from cache
        analytics_data = _gather_weekly_analytics(institution_id)

        # Step 2: Generate digest content
        progress.update("Generating digest content")

        subject = f"Weekly Analytics Digest - {analytics_data.get('week_period', 'Current Week')}"

        html_content = _generate_analytics_digest_html(analytics_data)
        text_content = _generate_analytics_digest_text(analytics_data)

        # Step 3: Send to recipients
        progress.update("Sending digest emails")

        results = []
        for email in recipient_emails:
            email_result = _send_email(
                to_email=email,
                subject=subject,
                html_content=html_content,
                text_content=text_content
            )

            results.append({
                "recipient": email,
                "sent": email_result["success"],
                "error": email_result.get("error")
            })

        # Step 4: Finalize
        progress.update("Finalizing digest delivery")

        successful_sends = len([r for r in results if r["sent"]])

        result = {
            "job_id": job_id,
            "notification_type": "weekly_digest",
            "institution_id": institution_id,
            "recipients": len(recipient_emails),
            "successful_sends": successful_sends,
            "results": results,
            "sent_at": datetime.now().isoformat(),
            "status": "completed" if successful_sends == len(recipient_emails) else "partial_failure"
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Weekly analytics digest")
        raise


# Email sending utilities

def _send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    priority: str = "normal"
) -> Dict[str, Any]:
    """
    Send email using SMTP configuration.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text email content
        priority: Email priority (normal, high, low)

    Returns:
        Email sending result
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.SMTP_FROM_EMAIL
        msg['To'] = to_email

        # Add priority header if needed
        if priority == "high":
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'

        # Attach parts
        text_part = MIMEText(text_content, 'plain')
        html_part = MIMEText(html_content, 'html')

        msg.attach(text_part)
        msg.attach(html_part)

        # Send email
        if settings.SMTP_ENABLED:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)

            if settings.SMTP_TLS:
                server.starttls()

            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            server.send_message(msg)
            server.quit()

            logger.info(f"Email sent successfully to {to_email}")
            return {"success": True}
        else:
            # Email disabled - log instead
            logger.info(f"Email sending disabled. Would send to {to_email}: {subject}")
            return {"success": True, "note": "email_disabled"}

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"success": False, "error": str(e)}


# Content generation functions

def _generate_timetable_completion_html(timetable_data: Dict[str, Any]) -> str:
    """Generate HTML content for timetable completion notification."""
    assignment_rate = timetable_data.get("assignment_rate", 0)
    generation_time = timetable_data.get("generation_time", 0)
    semester = timetable_data.get("semester", "Unknown")

    status_color = "green" if assignment_rate >= 90 else "orange" if assignment_rate >= 75 else "red"

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                🎓 Timetable Generation Complete
            </h1>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2c3e50; margin-top: 0;">Generation Summary</h2>
                <p><strong>Semester:</strong> {semester}</p>
                <p><strong>Assignment Rate:</strong>
                   <span style="color: {status_color}; font-weight: bold;">{assignment_rate}%</span>
                </p>
                <p><strong>Generation Time:</strong> {generation_time:.1f} seconds</p>
                <p><strong>Total Assignments:</strong> {timetable_data.get("assignment_count", 0)}</p>
            </div>

            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #27ae60; margin-top: 0;">✅ Quality Metrics</h3>
                <ul>
                    <li>Penalty Score: {timetable_data.get("penalty_score", "N/A")}</li>
                    <li>Constraint Violations: {len(timetable_data.get("constraint_violations", []))}</li>
                    <li>Faculty Utilization: {timetable_data.get("avg_faculty_utilization", "N/A")}%</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{settings.FRONTEND_URL}/timetables/{timetable_data.get('timetable_id')}"
                   style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none;
                          border-radius: 6px; display: inline-block;">
                    View Timetable
                </a>
            </div>

            <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px;">
                Generated by TT-Scheduler System at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
            </p>
        </div>
    </body>
    </html>
    """


def _generate_timetable_completion_text(timetable_data: Dict[str, Any]) -> str:
    """Generate plain text content for timetable completion notification."""
    return f"""
    TIMETABLE GENERATION COMPLETE
    =============================

    Semester: {timetable_data.get("semester", "Unknown")}
    Assignment Rate: {timetable_data.get("assignment_rate", 0)}%
    Generation Time: {timetable_data.get("generation_time", 0):.1f} seconds
    Total Assignments: {timetable_data.get("assignment_count", 0)}

    Quality Metrics:
    - Penalty Score: {timetable_data.get("penalty_score", "N/A")}
    - Constraint Violations: {len(timetable_data.get("constraint_violations", []))}
    - Faculty Utilization: {timetable_data.get("avg_faculty_utilization", "N/A")}%

    View your timetable: {settings.FRONTEND_URL}/timetables/{timetable_data.get('timetable_id')}

    Generated by TT-Scheduler System at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
    """


def _generate_import_completion_html(import_data: Dict[str, Any]) -> str:
    """Generate HTML content for import completion notification."""
    success_rate = (import_data.get("successful_imports", 0) / max(import_data.get("total_processed", 1), 1)) * 100

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                📊 Data Import Complete
            </h1>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2c3e50; margin-top: 0;">Import Summary</h2>
                <p><strong>Import Type:</strong> {import_data.get("type", "Data").title()}</p>
                <p><strong>File:</strong> {import_data.get("filename", "Unknown")}</p>
                <p><strong>Success Rate:</strong> {success_rate:.1f}%</p>
                <p><strong>Records Processed:</strong> {import_data.get("total_processed", 0)}</p>
                <p><strong>Successful:</strong> {import_data.get("successful_imports", 0)}</p>
                <p><strong>Failed:</strong> {import_data.get("failed_imports", 0)}</p>
            </div>

            {"<div style='background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;'><h3 style='color: #856404; margin-top: 0;'>⚠️ Import Errors</h3><ul>" + "".join([f"<li>{error}</li>" for error in import_data.get("errors", [])[:5]]) + "</ul></div>" if import_data.get("errors") else ""}

            <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px;">
                Processed by TT-Scheduler System at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
            </p>
        </div>
    </body>
    </html>
    """


def _generate_import_completion_text(import_data: Dict[str, Any]) -> str:
    """Generate plain text content for import completion notification."""
    success_rate = (import_data.get("successful_imports", 0) / max(import_data.get("total_processed", 1), 1)) * 100

    error_text = ""
    if import_data.get("errors"):
        error_text = "\n\nErrors encountered:\n" + "\n".join([f"- {error}" for error in import_data.get("errors", [])[:5]])

    return f"""
    DATA IMPORT COMPLETE
    ===================

    Import Type: {import_data.get("type", "Data").title()}
    File: {import_data.get("filename", "Unknown")}
    Success Rate: {success_rate:.1f}%

    Records Processed: {import_data.get("total_processed", 0)}
    Successful: {import_data.get("successful_imports", 0)}
    Failed: {import_data.get("failed_imports", 0)}

    {error_text}

    Processed by TT-Scheduler System at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
    """


def _generate_system_alert_html(alert_type: str, alert_data: Dict[str, Any]) -> str:
    """Generate HTML content for system alerts."""
    alert_colors = {"error": "#e74c3c", "warning": "#f39c12", "info": "#3498db"}
    color = alert_colors.get(alert_type, "#7f8c8d")

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: {color}; border-bottom: 2px solid {color}; padding-bottom: 10px;">
                🚨 System Alert: {alert_type.title()}
            </h1>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2c3e50; margin-top: 0;">{alert_data.get("title", "System Notification")}</h2>
                <p><strong>Time:</strong> {alert_data.get("timestamp", datetime.now().isoformat())}</p>
                <p><strong>Severity:</strong> {alert_type.title()}</p>

                <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
                    {alert_data.get("description", "No description provided")}
                </div>

                {"<div style='margin-top: 15px;'><strong>Additional Details:</strong><pre style='background: #f4f4f4; padding: 10px; overflow-x: auto;'>" + str(alert_data.get("details", "")) + "</pre></div>" if alert_data.get("details") else ""}
            </div>

            <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px;">
                TT-Scheduler System Alert at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
            </p>
        </div>
    </body>
    </html>
    """


def _generate_system_alert_text(alert_type: str, alert_data: Dict[str, Any]) -> str:
    """Generate plain text content for system alerts."""
    details_text = f"\n\nDetails:\n{alert_data.get('details', '')}" if alert_data.get('details') else ""

    return f"""
    SYSTEM ALERT: {alert_type.upper()}
    ================================

    Title: {alert_data.get("title", "System Notification")}
    Time: {alert_data.get("timestamp", datetime.now().isoformat())}
    Severity: {alert_type.title()}

    Description:
    {alert_data.get("description", "No description provided")}

    {details_text}

    TT-Scheduler System Alert at {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}
    """


def _generate_analytics_digest_html(analytics_data: Dict[str, Any]) -> str:
    """Generate HTML content for weekly analytics digest."""
    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                📈 Weekly Analytics Digest
            </h1>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #2c3e50; margin-top: 0;">Week Summary</h2>
                <p><strong>Period:</strong> {analytics_data.get("week_period", "Current Week")}</p>
                <p><strong>Timetables Generated:</strong> {analytics_data.get("timetables_generated", 0)}</p>
                <p><strong>Average Assignment Rate:</strong> {analytics_data.get("avg_assignment_rate", 0)}%</p>
                <p><strong>Total Faculty Hours:</strong> {analytics_data.get("total_faculty_hours", 0)}</p>
            </div>

            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #27ae60; margin-top: 0;">📊 Key Metrics</h3>
                <ul>
                    <li>Faculty Utilization: {analytics_data.get("avg_faculty_utilization", 0)}%</li>
                    <li>Room Utilization: {analytics_data.get("avg_room_utilization", 0)}%</li>
                    <li>System Uptime: {analytics_data.get("system_uptime", "99.9")}%</li>
                </ul>
            </div>

            <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px;">
                TT-Scheduler Weekly Digest - {datetime.now().strftime('%Y-%m-%d')}
            </p>
        </div>
    </body>
    </html>
    """


def _generate_analytics_digest_text(analytics_data: Dict[str, Any]) -> str:
    """Generate plain text content for weekly analytics digest."""
    return f"""
    WEEKLY ANALYTICS DIGEST
    ======================

    Period: {analytics_data.get("week_period", "Current Week")}
    Timetables Generated: {analytics_data.get("timetables_generated", 0)}
    Average Assignment Rate: {analytics_data.get("avg_assignment_rate", 0)}%
    Total Faculty Hours: {analytics_data.get("total_faculty_hours", 0)}

    Key Metrics:
    - Faculty Utilization: {analytics_data.get("avg_faculty_utilization", 0)}%
    - Room Utilization: {analytics_data.get("avg_room_utilization", 0)}%
    - System Uptime: {analytics_data.get("system_uptime", "99.9")}%

    TT-Scheduler Weekly Digest - {datetime.now().strftime('%Y-%m-%d')}
    """


def _gather_weekly_analytics(institution_id: str) -> Dict[str, Any]:
    """Gather weekly analytics data for digest."""
    # This would typically query the database or call analytics services
    # For now, return placeholder data

    from datetime import datetime, timedelta

    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)

    return {
        "week_period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        "timetables_generated": 5,
        "avg_assignment_rate": 92.5,
        "total_faculty_hours": 1250,
        "avg_faculty_utilization": 78.3,
        "avg_room_utilization": 65.8,
        "system_uptime": "99.9"
    }