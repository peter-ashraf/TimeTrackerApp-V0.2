# Check-in Reminders: iOS Web Push Setup

This app uses the reliable iOS PWA notification path:

1. The installed PWA asks for notification permission from a user tap.
2. The browser creates a Web Push subscription.
3. The subscription is saved in Supabase `push_subscriptions`.
4. A Supabase scheduled job invokes `checkin-reminders` every minute.
5. The Edge Function sends Web Push notifications to due users.
6. iOS receives the push through the system notification service and wakes the service worker to display it.

With this setup, the app does not need to be open or visible in recent apps. The device still needs network access, notification permission, and iOS must not be blocking the PWA through Focus or notification settings.

## iOS Requirements

- iOS or iPadOS 16.4 or newer.
- The app must be installed to the Home Screen.
- The app must be opened from the Home Screen icon.
- The production app must be served over HTTPS.
- The PWA manifest must use a standalone-style display mode.
- Notification permission must be granted from a user action.
- iOS Settings > Notifications > TimeTracker must allow notifications.
- Focus / Do Not Disturb must not suppress the notification.

## Required Environment Values

The frontend build needs:

```env
VITE_VAPID_PUBLIC_KEY=<same public VAPID key used by the Edge Function>
```

The Supabase Edge Function needs secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY="<public-key>" --project-ref <project-ref>
supabase secrets set VAPID_PRIVATE_KEY="<private-key>" --project-ref <project-ref>
supabase secrets set VAPID_SUBJECT="mailto:<admin-email>" --project-ref <project-ref>
```

The public key must match on both sides. If they differ, the browser subscription can be created with one key while the server signs pushes with another, and delivery will fail.

## Deploy Steps

1. Apply the reminder schema:

```bash
supabase db push --project-ref <project-ref>
```

2. Deploy the Edge Function:

```bash
supabase functions deploy checkin-reminders --project-ref <project-ref>
```

3. Schedule the function to run every minute using the SQL in:

```text
supabase/sql/schedule_checkin_reminders.sql
```

4. Deploy the frontend with `VITE_VAPID_PUBLIC_KEY` available during build.

5. In the installed iOS PWA, go to Settings > Reminders:

- Enable Reminders.
- Save Reminder Settings.
- Enable Push Notifications.

## Verification

Check that the device subscription exists:

```sql
select user_id, endpoint, updated_at, last_used_at
from push_subscriptions
order by updated_at desc;
```

Check that reminder preferences are enabled:

```sql
select user_id, enabled, start_time, reminder_count, interval_minutes, timezone
from reminder_preferences
where enabled = true;
```

Invoke the function manually with a service-role bearer token:

```bash
curl -i \
  -X POST "https://<project-ref>.supabase.co/functions/v1/checkin-reminders" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{
  "success": true,
  "results": [
    {
      "userId": "...",
      "date": "2026-06-15",
      "sent": 1,
      "failed": 0,
      "slot": 1
    }
  ]
}
```

Common non-error statuses:

- `No users with enabled reminders`: no enabled reminder preferences exist.
- `no_push_subscriptions`: reminders are enabled, but that user has no saved device subscription.
- `skipped_concurrency_or_error`: another invocation likely updated the same reminder log first.

## Important Limit

The in-app Test Notifications button is only for local display testing. Repeating test notifications still depend on page timers, which mobile browsers can pause. Production reminders must be sent by the Supabase scheduler and Edge Function.
