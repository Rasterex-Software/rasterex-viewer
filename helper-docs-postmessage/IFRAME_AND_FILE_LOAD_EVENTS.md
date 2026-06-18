# Iframe and File Load Events

This document explains the events involved when the Viewsoft Canvas viewer is embedded in an iframe and when files are opened through the viewer message broker. The main point is to keep iframe readiness separate from document/file readiness.

## Message Shape

All parent-to-viewer commands are sent to the iframe window:

```ts
iframe.contentWindow?.postMessage({ type, payload }, targetOrigin);
```

All viewer-to-parent callbacks are received by the parent window:

```ts
window.addEventListener('message', (event) => {
  const { type, payload, message } = event.data ?? {};
});
```

The current code posts with `'*'`. A parent application should validate `event.origin` where the viewer origin is known.

## Iframe Load Lifecycle

There are two different readiness points:

1. Browser iframe load: the HTML document has loaded enough for the browser to fire the iframe element's native `load` event.
2. Viewer ready: the RxCore viewer and Foxit layer are both initialized and the viewer can safely receive commands.

Parent code should treat these as separate states.

### Native iframe `load`

This is not a `postMessage` event from the viewer. It is the DOM event on the iframe element:

```ts
iframe.addEventListener('load', () => {
  // The iframe document loaded. Viewer internals may still be initializing.
});
```

Use this for low-level iframe status only. Do not treat it as permission to call `view`, `viewAny`, or `viewFile` unless the parent has also received `viewerReady`.

### `viewerReady`

Direction: viewer -> parent

Payload: none

Emitted when:

- `RXCore.onGuiReady(...)` has fired.
- `RXCore.onGuiFoxitReady(...)` has fired.
- The viewer is running embedded (`window !== top`).
- It has not already emitted `viewerReady`.

Example:

```json
{ "type": "viewerReady" }
```

Parent meaning:

- The iframe viewer runtime is initialized.
- It is now safe to send viewer commands such as `view`, `viewAny`, `viewFile`, `setUser`, `collaboration`, `guiMode`, `getScales`, etc.
- This does not mean a file is open.

Event notes:

- Treat `viewerReady` as the command-ready event.
- Keep the native iframe `load` as a separate browser iframe load event.

## File Open Commands

The file load path is driven by these parent-to-viewer commands.

### `view`

Direction: parent -> viewer

Purpose: open a file by URL using a structured payload.

Payload:

```ts
type ViewPayload = {
  fileUrl?: string;
  filePath?: string;
  displayName?: string;
  name?: string;
  cacheId?: string;
  mime?: string;
};
```

Notes:

- `fileUrl` or `filePath` is required.
- `displayName` may also be sent as `displayname`; both are accepted by the current broker.
- `cacheId` may also be sent as `cacheid`; both are accepted by the current broker.
- If `displayName`, `mime`, or `cacheId` is provided, the viewer passes an object spec into `RXCore.openFile(...)`.
- Default `mime` is `application/pdf`.
- `displayName` must be end with extension like Sample.pdf, ABC Testing.pdf
- `cacheId` is used to get the existing content from server instead of creating new content each time. help improve performance

### `viewAny`

Direction: parent -> viewer

Purpose: open a file by URL. It accepts either a string or the same object shape as `view`.

Payload:

```ts
type ViewAnyPayload = string | ViewPayload;
```

Notes:

- If payload is a string, it is treated as the file URL.
- If payload is an object, `filePath` or `fileUrl` is used.

### `viewFile`

Direction: parent -> viewer

Purpose: upload a browser `File`, then open the uploaded file.

Payload:

```ts
type ViewFilePayload =
  | File
  | {
      file: File;
      cacheId?: string;
    };
```

Notes:

- The viewer calls `RXCore.uploadFile(file)`.
- `cacheId` may also be sent as `cacheid`; both are accepted by the current broker.
- During broker-managed upload, the normal upload auto-open is suppressed.
- After upload, the viewer builds the open URL from `RXCore.Config.baseFileURL + file.name`, remembers metadata, and opens it with `RXCore.openFile(...)`.

## File Load Callback Sequence

A normal URL open through `view` or `viewAny` currently follows this parent-observable sequence:

1. Parent sends `view` or `viewAny`.
2. Viewer posts `progressStart`.
3. Viewer calls `RXCore.openFile(...)`.
4. Internal RxCore states may fire, including `GUI_State` sources such as `openFile`, `openFileComplete`, `setActiveDocument`, or `forcepagesState`.
5. Internal `GUI_FileLoadComplete` fires.
6. Angular publishes the internal `guiFileLoadComplete$`.
7. Viewer posts updated file-related messages such as `fileTabs`, `fileInfo`, and `pageList`.
8. Viewer posts `progressEnd`.

For `viewFile`, upload happens before open:

1. Parent sends `viewFile`.
2. Viewer posts `progressStart`.
3. Viewer uploads the file with `RXCore.uploadFile(file)`.
4. Internal `GUI_UploadComplete` fires with the uploaded path/name.
5. Viewer suppresses upload auto-open for this broker-managed request.
6. Viewer calls `RXCore.openFile(...)`.
7. Internal `GUI_FileLoadComplete` fires.
8. Viewer posts updated `fileTabs`, `fileInfo`, and `pageList`.
9. Viewer posts `progressEnd`.

Important: there is currently no explicit outbound `fileLoadComplete` postMessage. Parent code can infer file readiness from the combination of file-related messages and `progressEnd`.

## File Load Events Viewer Sends Back

### `progressStart`

Direction: viewer -> parent

Payload shape:

```ts
type ProgressStartMessage = {
  type: 'progressStart';
  message: string;
};
```

When sent:

- Before `view` / `viewAny` opens a URL.
- Before `viewFile` uploads and opens a file.
- Also used by other long operations such as export, print, and compare.

Parent meaning:

- Show loading UI.
- If the parent tracks a specific file-open request, mark it as `loading`.
- Do not assume this always means file load; check whether the parent currently has a pending open command.

Example messages:

- `It takes a few seconds to open the file.`
- `It takes a few seconds to upload and open the file.`

### `progressEnd`

Direction: viewer -> parent

Payload: none

When sent:

- After a `view`, `viewAny`, or `viewFile` broker operation has finished waiting for internal file load completion.
- Also sent by other long operations.
- Sent in some error/no-file paths to close progress UI.

Parent meaning:

- Hide loading UI for the current operation.
- For file opens, treat this as "the broker finished waiting", not as the only source of file metadata.
- Pair it with `fileInfo` or `fileTabs` before treating a file-open request as complete.

### `fileTabs`

Direction: viewer -> parent

Payload:

```ts
type FileTabIcon = 'pdf' | 'image' | 'cad' | 'doc' | 'generic';

type FileTab = {
  id: string;
  title: string;
  icon?: FileTabIcon;
  coreId?: string | number;
  index?: number;
};

type FileTabsMessage = {
  type: 'fileTabs';
  payload: {
    tabs: FileTab[];
    activeId: string;
  };
};
```

When sent:

- After internal file load completion.
- When the number of opened files changes.
- When active document state changes through `setActiveDocument` or `forcepagesState`.

Parent meaning:

- Update parent state for all open files.
- Use `activeId` to know the current active file.
- This is a strong signal that the viewer has an open-file list available.

Notes:

- Extracted temporary page names are filtered out.
- Icon is inferred from extension.

### `fileInfo`

Direction: viewer -> parent

Payload:

```ts
type FileInfoUpdate = {
  fileInfo: unknown | null;
  activeId: string;
  activeIndex?: number;
};
```

The sanitized `fileInfo` object may include:

```ts
type SanitizedFileInfo = {
  url?: string;
  name?: string;
  date?: unknown;
  width?: unknown;
  height?: unknown;
};
```

When sent:

- After internal file load completion.
- When the number of opened files changes.
- When active document state changes through `setActiveDocument` or `forcepagesState`.

Parent meaning:

- Use this as the primary file metadata event.
- If `fileInfo.name` or `fileInfo.url` exists, the parent can update the active document identity.
- Combine with `fileTabs.activeId` when resolving an open request.

### `pageList`

Direction: viewer -> parent

Payload:

```ts
type PageListItem = {
  index: number;
  pageNumber: number;
  title?: string;
  label: string;
  isSelected: boolean;
  thumbnailDataUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
};

type PageListSnapshot = {
  requestId?: string;
  activeId: string;
  activeIndex?: number;
  currentPage: number;
  pageCount: number;
  pages: PageListItem[];
};
```

When sent:

- After internal file load completion.
- On page changes.
- When thumbnails arrive.
- When open-file count changes.
- When active document state changes through `setActiveDocument` or `forcepagesState`.

Parent meaning:

- Use it to expose page count, current page, labels, and thumbnails.
- Do not require thumbnails before considering a file open complete; thumbnails may arrive later or be unavailable.

### Internal `GUI_FileLoadComplete`

Direction: internal RxCore -> Angular only

This is not currently posted to the parent. It is used inside the viewer to:

- Add the file to recent files.
- Run `RXCore.zoomFit()`.
- Emit `rxCoreService.guiFileLoadComplete$`.
- Trigger `fileTabs`, `fileInfo`, and `pageList` synchronization.
- Let file-open broker commands end their waiting period.

Parent meaning:

- The parent cannot listen to this directly.
- Parent code should not document it as an external event unless the viewer is changed to post it.

### Internal `GUI_UploadComplete`

Direction: internal RxCore -> Angular only

This is not currently posted to the parent. It is used by `viewFile` to know the upload produced a usable path/name.

Parent meaning:

- The parent cannot listen to upload completion directly today.
- For `viewFile`, treat upload progress/status as part of the same file-open loading phase unless the viewer adds explicit upload events.

## Event Summary

- Use iframe DOM `load` only for iframe HTML load.
- Use `viewerReady` for command readiness.
- Use `progressStart` / `progressEnd` for operation-level loading UI.
- Use `fileTabs` for open-files and active-file state.
- Use `fileInfo` for active file metadata.
- Use `pageList` for page count, current page, and thumbnails.
- Do not expose internal `GUI_FileLoadComplete` or `GUI_UploadComplete` as external events unless the viewer starts posting them.
