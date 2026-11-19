# Editing and Count acceptance

Connect the local parent and open the disposable test PDF. Expand **Editing
and Count**. Test the sequence in Legacy and Modern on separate test PDFs.

1. Read tool state and inspect the returned tool, navigation and SNAP values.
2. Create an annotation or use **Annotation import → Inline JSON → Use sample
   data → Import annotations** to load the editable rectangle. Choose the
   rectangle under **Stored annotation checks**. Use **Delete selected**,
   **Undo**, and **Redo**. Check that the rectangle disappears, returns, then
   disappears. Canvas may assign a new GUID when restoring a deleted record.
   The parent refreshes the list after each command.
3. Set a Count name, marker prefix, optional symbol and numbering. Choose
   **Configure and start Count**, then place two markers inside the viewer.
   Choose **Finish Count**. The new group should appear in the saved list.
   Try finishing a separate draft inside Canvas to check the native event.
4. To test an imported group, use **Annotation import → Use editable Count
   sample → Import annotations**. Select the imported group and verify that
   **Read markers** reports six markers with distinct IDs. Use **Insert one
   marker**, click the document, then **Read markers**. Check that the original
   IDs remain and the marker count increases. You can also repeat this with
   the group you created in step 3.
5. Start point mode, add two markers, then stop point mode. Read the marker list
   again to check the added items. Stop point mode before creating another group.
6. Pick a marker and save a JSON object such as `{"reference":"A-01","checked":true}`.
   Read the markers again and check that the same ID carries the new fields.
   Other markers should retain their own metadata.

Use the command result and annotation list together. An acknowledgement of
insertion arms the native gesture. The marker is added when the user clicks.

Canvas uses the annotation signature for native edit selection. The built-in
rectangle and Count samples belong to the local test user. Imported files keep
their original signatures. A Count owned by another user can still be listed
and read, and the parent reports why it cannot arm insertion.
