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
      return new Response(
        JSON.stringify({ status: "No users with enabled reminders" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    for (const user of users) {
      try {
        const userDateStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: user.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(nowUtc);

        const parts = userDateStr.split("-");
        const normalizedUserDateStr =
          parts.length === 3
            ? userDateStr
            : (() => {
                const fallback = userDateStr.split("/").join("-");
                const p = fallback.split("-");
                return `${p[2]}-${p[0]}-${p[1]}`;
              })();

        const userTimeStr = new Intl.DateTimeFormat("en-GB", {
          timeZone: user.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(nowUtc);

        if (userTimeStr < user.start_time) {
          continue;
        }

        const { data: logData, error: logError } = await supabase
          .from("reminder_logs")
          .select("*")
          .eq("user_id", user.user_id)
          .eq("date", normalizedUserDateStr)
          .single();

        let log = logData;

        if (!log && logError && logError.code === "PGRST116") {
          const { data: newLog, error: newLogError } = await supabase
            .from("reminder_logs")
            .insert({
              user_id: user.user_id,
              date: normalizedUserDateStr,
              last_sent_slot: 0,
              reminders_sent: 0,
              suppressed: false,
            })
            .select()
            .single();

          if (newLogError) throw newLogError;
          log = newLog;
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
            status: "skipped_concurrency_or_error",
          });
          continue;
        }

        const { data: subs, error: subError } = await supabase
          .from("push_subscriptions")
          .select("endpoint, keys")
          .eq("user_id", user.user_id);

        if (subError) throw subError;

        let sentCount = 0;
        let failedCount = 0;

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title: `TimeTracker Reminder (${sequenceNumber}/${user.reminder_count})`,
            body: "Don't forget to log your daily check-in!",
          });

          for (const sub of subs) {
            try {
              const subscription: PushSubscription = {
                endpoint: sub.endpoint,
                keys: sub.keys,
              };

              await appServer.send(subscription, payload);
              sentCount++;
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
        }

        results.push({
          userId: user.user_id,
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

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduler Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});