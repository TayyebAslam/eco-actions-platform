/**
 * Generates firebase-messaging-sw.js from environment variables.
 * Run before `next dev` or `next build` so the service worker
 * never contains hardcoded credentials in source control.
 */
const fs = require("fs");
const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load `.env*` files (same behavior as Next.js) for standalone script execution.
loadEnvConfig(path.join(__dirname, ".."));

const {
  NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID,
} = process.env;

if (
  !NEXT_PUBLIC_FIREBASE_API_KEY ||
  !NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  !NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  !NEXT_PUBLIC_FIREBASE_APP_ID
) {
  console.warn(
    "Firebase env vars not set — skipping firebase-messaging-sw.js generation"
  );
  process.exit(0);
}

// Read Firebase SDK version from package.json to keep CDN in sync
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const firebaseVersion = (pkg.dependencies.firebase || "12.10.0").replace(
  /^\^|~|>=?/,
  ""
);

const sw = `/* eslint-disable no-undef */
/* AUTO-GENERATED — do not edit. Run "node scripts/generate-firebase-sw.js" */
importScripts(
  "https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: ${JSON.stringify(NEXT_PUBLIC_FIREBASE_API_KEY)},
  authDomain: ${JSON.stringify(NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "")},
  projectId: ${JSON.stringify(NEXT_PUBLIC_FIREBASE_PROJECT_ID)},
  messagingSenderId: ${JSON.stringify(NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)},
  appId: ${JSON.stringify(NEXT_PUBLIC_FIREBASE_APP_ID)},
});

var messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage(function (payload) {
  var notificationTitle = payload.notification?.title || "Eco Actions";
  var notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icons/leaf.svg",
    badge: "/icons/leaf.svg",
    tag: payload.data?.type || "default",
    data: payload.data || {},
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var clickUrl = "/dashboard";

  var type = data.type;
  if (type === "school_request") {
    clickUrl = "/dashboard/school-requests";
  } else if (
    type === "pending_activities" ||
    type === "activity_approved" ||
    type === "activity_rejected" ||
    type === "comment_received"
  ) {
    clickUrl = "/dashboard/activities";
  } else if (type === "challenge_joined") {
    clickUrl = "/dashboard/challenges";
  } else if (type === "new_article") {
    clickUrl = data.resource_id
      ? "/dashboard/articles/view/" + data.resource_id
      : "/dashboard/articles";
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus().then(function (focused) {
              return focused.navigate(clickUrl);
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(clickUrl);
        }
      })
  );
});
`;

const outPath = path.join(
  __dirname,
  "..",
  "public",
  "firebase-messaging-sw.js"
);
fs.writeFileSync(outPath, sw, "utf8");
console.log(
  "Generated public/firebase-messaging-sw.js (Firebase SDK v" +
    firebaseVersion +
    ")"
);
