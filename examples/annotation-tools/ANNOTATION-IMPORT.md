# Local annotation import checks

Connect to local Canvas, open the synthetic test PDF, and expand **Annotation
import**. Keep the same document active while the command is running.

1. In Legacy, choose **Inline JSON**, click **Use sample data**, and import.
   Find the sample GUID in **Stored annotation checks**.
2. Import the sample again with **Merge (skip matching JSON GUIDs)**. The
   annotation list should still contain one matching record. Canvas may report
   both `loaded: 1` and `skipped: 1` for that existing record.
3. Change `LineColor` in the JSON, choose **Merge (replace matching JSON GUIDs)**,
   import, and use **Read properties** to check the same GUID and updated style.
4. Switch **Appearance** to Modern and repeat. For a full replacement test,
   choose **Replace all annotations** and confirm the clear on the disposable PDF.
5. To check calibration, create a measurement at a known scale, choose **Copy
   current records here**, and restore that snapshot with **Preserve saved scales**.
   Check the resulting GUID, shape and scale in **Measurement / vertex inspection**.
   Repeat with the current page scale option to check Canvas's rebinding behavior.
6. Choose **Paste Rasterex XML (local URL)**, paste an RXML export or click
   **Use sample data**, then import. The test parent serves the pasted content
   from a temporary URL on the local Canvas proxy and uses the SDK's URL import.
   Look for Area with GUID starting `85B7B9C1-502` when using the sample. Use a
   fresh test PDF to repeat in the other appearance mode.
   **Rasterex XML URL** still accepts an existing URL. Its local sample uses
   Canvas's `/assets/exmaple-rxml.rxml` and imports Area `13A64756-F9D…`.
   Both choices merge through the native URL loader.
7. To check malformed input on the disposable PDF, select replace-all and enter
   invalid JSON. The SDK should return an error before sending a clear/import.

The example waits 20 seconds for each import receipt. Record counts come from
Canvas and cannot by themselves establish new creation or a complete restore.
The panel refreshes the annotation list after a receipt. Creation events are
optional and do not serve as the import acknowledgement.

The local smoke test loaded the JSON sample in Legacy and observed duplicate
skipping without adding a second record. In Modern, explicit replace-all
returned one imported record and the refreshed list contained the sample GUID.
The SDK suite passed all 85 tests, package checks and standalone parent type
checking. Calibration round trips still need manual acceptance.

The paste option requires the proxy started by `npm run dev:annotations`.
The local server holds up to 2 MiB per paste in memory for two minutes. It uses
the URL import because the direct inline command timed out on this Canvas
build. The paste workflow loaded the sample Area on fresh PDFs in both
Legacy and Modern.

The user confirmed pasted RXML import works in Modern and Legacy and approved
the SDK version bump to 2.2.8.
