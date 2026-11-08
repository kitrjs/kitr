---
title: Overview
description: Accept file uploads with size limits, store them on disk or in the cloud, and show progress in the browser.
order: 0
---

# Uploads

Avatars, signed invoices, CSV imports: sooner or later an app takes files from people. The browser side needs a progress bar and a check before sending. The server side needs the same check again, a place to put the bytes, a record to save, and a safe way to serve the file back. Most apps do half of each.

`@kitr/uploads` does the whole round trip, with the rules shared between client and server.

## What it is

`@kitr/uploads` has a browser half and a server half. In the browser, `upload()` and `useUpload` send a file with progress and cancellation, after `checkFile` has confirmed its size and type against rules you define once. On the server, `mountUploads` receives files in a controller, checks them against the same rules, stores the bytes through a driver and answers with a `StoredFile` record you save in your database. `servedFileHeaders` serves files back safely, and private files go through a controller that checks permissions first.

It runs on both sides: `@kitr/uploads` and `@kitr/uploads/react` in the browser, `@kitr/uploads/server` on the [server](/packages/server). It handles files people send to your app. To read and write files on the user's own device, use [files](/packages/files) instead.

## Built on

`@kitr/uploads` is built on [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and `XMLHttpRequest` progress events in the browser, and on the [h3](https://h3.dev) server's multipart parsing with kitr's body limits on the server. Storage goes through an `UploadsDriver`: disk is built in, memory is built in for tests, and the [Extend](/packages/uploads/guide#extend) section shows one for S3-compatible object storage such as AWS S3 and Cloudflare R2.

kitr adds the shared `UploadRules`, the progress and cancellation API, the React hook, the error shape that lands under a form field, the file record, safe serving headers and the driver interface.

## Problems it solves

- **Uploads with no progress.** `useUpload` gives progress, status and cancel. See [Track progress and cancel](/packages/uploads/guide#track-progress-and-cancel).
- **Size and type checked on one side only.** Rules are defined once and run in the browser and on the server. See [Share rules between client and server](/packages/uploads/guide#share-rules-between-client-and-server).
- **Files with no record.** The server answers with a `StoredFile` you save next to the order or user. See [Store the record in your database](/packages/uploads/guide#store-the-record-in-your-database).
- **Serving uploads unsafely.** Headers that stop a PDF from running as HTML, and a controller for private files. See [Serve files safely](/packages/uploads/guide#serve-files-safely) and [Serve private files](/packages/uploads/guide#serve-private-files).
- **Errors in a generic alert.** A rejected file is a field error under the input. See [Show field errors in a form](/packages/uploads/guide#show-field-errors-in-a-form).
- **Disk in development, object storage in production.** Swap the driver in config. See [Drivers](/packages/uploads/guide#drivers).

## Further reading

- [Guide](/packages/uploads/guide): install, configure and every task.
- [API reference](/packages/uploads/api): every export of the four entry points.
- [FormData on MDN](https://developer.mozilla.org/en-US/docs/Web/API/FormData): what `upload()` sends.
- [Server](/packages/server), [API](/packages/api) and [Forms](/packages/forms): body limits, controllers for files that belong to a record, and field errors.
- [Files](/packages/files): the other direction, files on the user's device.
