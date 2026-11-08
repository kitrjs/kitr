---
title: Overview
description: Ask for permission and show local or scheduled notifications that open the right page when tapped.
order: 0
---

# Notifications

A reminder to approve an invoice, a note that an order has shipped, a nudge before a meeting: some things should reach people even when your tab is in the background. The browser's Notification API gives you the popup. It does not give you stable ids, scheduling, or a way to know which notification was tapped and where the app should go.

`@kitr/notifications` adds those, with one service that works the same in the browser and in native shells.

## What it is

`@kitr/notifications` is a `notifications` service to ask for permission, show a notification now or at a set time, replace or cancel one by id, and find out which one was tapped so the app opens the right page. React hooks give you the permission state and the tap. A memory driver makes it testable, and a driver slot lets a native shell plug in the operating system's own notifications.

It runs in the browser and in desktop and mobile shells; on the server the service shows nothing. It covers notifications the app shows itself. Push notifications sent from your server while the app is closed need a push service (APNs, FCM or Web Push) on top.

## Built on

In the browser, `@kitr/notifications` is built on the [Notification API](https://developer.mozilla.org/docs/Web/API/Notifications_API), with timers for scheduling and the service worker from the [web](/packages/web) platform's PWA option where Chrome for Android requires it. kitr adds stable ids you can cancel by, a `url` carried from the notification to its tap, `useNotificationPermission` and `useNotificationTap`, the memory driver and the `NotificationsDriver` interface.

## Problems it solves

- **Asking for permission at the wrong moment.** Ask from a button the person understands, and read the state with a hook. See [Ask for permission](/packages/notifications/guide#ask-for-permission).
- **Duplicate notifications.** Showing again with the same id replaces the old one. See [Replace a notification](/packages/notifications/guide#replace-a-notification).
- **Reminders for later.** Schedule a notification for a time, and cancel it if the task is done early. See [Schedule a notification](/packages/notifications/guide#schedule-a-notification).
- **Taps that open the home page.** Each notification carries a `url`, and the tap hook navigates there. See [Open the right page when tapped](/packages/notifications/guide#open-the-right-page-when-tapped).
- **Nothing showing on Android.** Chrome for Android needs a service worker; the guide shows the PWA setup. See [Show notifications on Chrome for Android](/packages/notifications/guide#show-notifications-on-chrome-for-android).

## Further reading

- [Guide](/packages/notifications/guide): install, configure and every task.
- [API reference](/packages/notifications/api): every export and type.
- [Notifications API on MDN](https://developer.mozilla.org/docs/Web/API/Notifications_API) and [Push API on MDN](https://developer.mozilla.org/docs/Web/API/Push_API): what each browser supports, and what server push needs.
- [Web](/packages/web), [Jobs](/packages/jobs) and [Realtime](/packages/realtime): the service worker, server-side reminders, and the events that trigger a notification.
