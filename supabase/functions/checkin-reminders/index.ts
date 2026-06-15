import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ApplicationServer,
  type PushSubscription,
} from "jsr:@negrel/webpush";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
}

const appServer = await ApplicationServer.new({
  contactInformation: vapidSubject,
  vapidKeys: {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  },
});

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getDateInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

const getMinutesInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return Number(partMap.hour) * 60 + Number(partMap.minute);
};

const getMinutesFromTime = (timeValue: string) => {
  const [hours = "0", minutes = "0"] = timeValue.split(":");
  return Number(hours) * 60 + Number(minutes);
};

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowUtc = new Date();
    const results: Array<Record<string, unknown>> = [];

    const { data: users, error: prefError } = await supabase
      .from("reminder_preferences")
      .select("user_id, start_time, reminder_count, interval_minutes, timezone")
      .eq("enabled", true);

    if (prefError) throw prefError;

    if (!users || users.length === 0) {
      return jsonResponse({ status: "No users with enabled reminders" });
    }

    for (const user of users) {
      try {
        const userTimeZone = user.timezone || "UTC";
        const userDate = getDateInTimeZone(nowUtc, userTimeZone);
        const userMinutes = getMinutesInTimeZone(nowUtc, userTimeZone);
        const startMinutes = getMinutesFromTime(user.start_time);

        if (userMinutes < startMinutes) {
          continue;
        }

        const { data: logData, error: logError } = await supabase
          .from("reminder_logs")
          .select("*")
          .eq("user_id", user.user_id)
          .eq("date", userDate)
          .single();

        let log = logData;

        if (!log && logError && logError.code === "PGRST116") {
          const { data: newLog, error: newLogError } = await supabase
            .from("reminder_logs")
            .insert({
              user_id: user.user_id,
              date: userDate,
              last_sent_slot: 0,
              reminders_sent: 0,
              suppressed: false,
            })
            .select()
            .single();

          if (newLogError) throw newLogError;
          log = newLog;
        } else if (logError) {
          throw logError;
        }

        if (!log || log.suppressed) {
          continue;
        }

        if (log.last_sent_slot >= user.reminder_count) {
          continue;
        }

        if (log.last_sent_at) {
          const lastSentTime = new Date(log.last_sent_at);
          const elapsedMinutes =
            (nowUtc.getTime() - lastSentTime.getTime()) / (1000 * 60);

          if (elapsedMinutes < user.interval_minutes) {
            continue;
          }
        }

        const { data: subs, error: subError } = await supabase
          .from("push_subscriptions")
          .select("endpoint, keys")
          .eq("user_id", user.user_id);

        if (subError) throw subError;

        if (!subs || subs.length === 0) {
          results.push({
            userId: user.user_id,
            date: userDate,
            status: "no_push_subscriptions",
          });
          continue;
        }

        const sequenceNumber = log.last_sent_slot + 1;

        const { data: updatedLog, error: updateError } = await supabase
          .from("reminder_logs")
          .update({
            last_sent_slot: sequenceNumber,
            reminders_sent: sequenceNumber,
            last_sent_at: nowUtc.toISOString(),
          })
          .eq("id", log.id)
          .eq("last_sent_slot", log.last_sent_slot)
          .select()
          .single();

        if (updateError || !updatedLog) {
          results.push({
            userId: user.user_id,
            date: userDate,
            status: "skipped_concurrency_or_error",
          });
          continue;
        }

        let sentCount = 0;
        let failedCount = 0;

        const payload = JSON.stringify({
          title: `TimeTracker Reminder (${sequenceNumber}/${user.reminder_count})`,
          body: "Don't forget to log your daily check-in!",
          url: "/TimeTrackerApp-V0.2/",
          tag: `checkin-reminder-${user.user_id}-${userDate}-${sequenceNumber}`,
        });

        for (const sub of subs) {
          try {
            const subscription: PushSubscription = {
              endpoint: sub.endpoint,
              keys: sub.keys,
            };

            await appServer.send(subscription, payload);
            sentCount++;

            await supabase
              .from("push_subscriptions")
              .update({ last_used_at: nowUtc.toISOString() })
              .eq("endpoint", sub.endpoint);
          } catch (err) {
            console.error(`Failed to send push to ${sub.endpoint}:`, err);
            failedCount++;

            const status = (err as { status?: number }).status ??
              (err as { statusCode?: number }).statusCode;

            if (status === 404 || status === 410) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .match({ endpoint: sub.endpoint });
            }
          }
        }

        results.push({
          userId: user.user_id,
          date: userDate,
          sent: sentCount,
          failed: failedCount,
          slot: sequenceNumber,
        });
      } catch (err) {
        console.error(`Error processing user ${user.user_id}:`, err);
        results.push({
          userId: user.user_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return jsonResponse({ success: true, results });
  } catch (error) {
    console.error("Scheduler Error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
