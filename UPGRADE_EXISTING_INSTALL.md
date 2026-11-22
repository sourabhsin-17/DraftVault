# DraftVault post-submission editing update

This patch adds owner-only editing and resubmission for applications that have already been submitted.

## Apply the patch without losing your local data

1. Stop the running server with `Ctrl+C` in Terminal.
2. Keep a backup of your existing project's `data/` and `storage/` folders. These contain the SQLite database and uploaded files.
3. Extract this ZIP into the root of your existing `autosave-form-management-system-final` project folder and allow the updated source files to replace the old ones.
4. Do not delete or replace `.env`, `data/`, or `storage/`.
5. From the project root, run `npm run lint`, then `npm test`.
6. Start the app again with `npm run dev` and refresh `http://localhost:3000`.

Open Dashboard → a submitted application. The application detail page should now show **Edit Application**. After editing, use **Save Revised Application**. The existing reference code is retained and the revision is recorded in status history.
