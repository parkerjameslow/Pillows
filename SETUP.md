# Setup — one-time Firebase configuration

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project** → name it `pillows` (or anything) → continue.
3. You can disable Google Analytics (not needed).
4. Click **Create project** and wait for it to finish.

## 2. Create a web app inside the project

1. On the project home page, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname like `pillows-web` → click **Register app**.
3. Copy the `firebaseConfig` object Firebase shows you.
4. Open `app.js` and replace the placeholder `firebaseConfig` with the one you copied.

## 3. Turn on Firestore

1. In the sidebar: **Build → Firestore Database**.
2. Click **Create database** → pick a location (e.g., `nam5`) → **Production mode** → **Create**.

## 4. Set the security rules

In Firestore, click the **Rules** tab. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Shows + their nested tasks (one task list per show)
    match /shows/{showId} {
      allow read, write: if true;

      match /tasks/{taskId} {
        allow read, write: if true;
      }
    }

    // Active-show pointer (which show is currently selected)
    match /meta/{docId} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**.

> ⚠️ Anyone with the URL can read or write. That's intentional (no login). Real protection here is "obscurity" — only people with the link know it exists.

## 5. Try it locally

```
cd /Users/parkerlow/Pillows
python3 -m http.server 8000
```

Open **http://localhost:8000** in a browser. You should see the app with a "No active show" message. Tap the **Shows** tab → **+** → name your first show → submit. The Pillow Show defaults will load and you can start checking tasks off.

## 6. Deploy to GitHub Pages (so your phone can reach it)

1. Push `main` to GitHub: `git push`
2. Open your repo's **Settings → Pages**
3. **Source:** "Deploy from a branch", **Branch:** `main`, folder `/ (root)` → **Save**
4. Wait ~1–2 minutes; refresh — your URL appears (`https://parkerjameslow.github.io/Pillows/`).

---

## How the app works

- **Shows tab** — Create one show per boutique-show event. Each show has its own task list and earnings. Tap a show card to make it active.
- **Tasks tab** — Shows the active show's checklist, grouped by Pre / Setup / During / Take Down. Tap a task → assignment sheet (pick who helped, override percentages, sum to 100% to confirm).
- **Earnings tab** — Per-person totals for the active show only. Switch shows in the Shows tab to see different totals.
- **+ on Tasks tab** — Add an ad-hoc task to the active show.
- **+ on Shows tab** — Create a new show with optional default-task seeding.
