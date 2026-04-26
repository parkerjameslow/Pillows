# Setup — one-time Firebase configuration

The app is built — it just needs to be connected to a Firebase project so multiple people share the same checklist in real time. Walk through these steps once.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project** → name it `pillows` (or anything) → continue.
3. You can disable Google Analytics (not needed).
4. Click **Create project** and wait for it to finish.

## 2. Create a web app inside the project

1. On the project home page, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname like `pillows-web` → click **Register app**.
3. Firebase will show you a `firebaseConfig` object that looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "pillows-xxxxx.firebaseapp.com",
     projectId: "pillows-xxxxx",
     storageBucket: "pillows-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```

4. **Copy that whole object.** Open `app.js` in this project, find the placeholder `firebaseConfig` near the top, and replace it with the one you copied.

## 3. Turn on Firestore (the shared database)

1. In the Firebase console sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** → pick a location close to you (e.g., `us-central`) → **Enable**.

## 4. Set the security rules (so anyone can read and write)

Since this list is intentionally public with no login, allow open read/write. **Note:** anyone with the URL can edit or delete tasks — that's the tradeoff for "no password."

1. In Firestore, click the **Rules** tab.
2. Replace the rules with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /tasks/{taskId} {
         allow read, write: if true;
       }
     }
   }
   ```

3. Click **Publish**.

## 5. Try it locally

Open `index.html` in a browser. You should see a banner that says **"No tasks yet"** with a **"Load defaults"** button. Click it — the full Pillow Show task list will populate. Open the page in a second tab; updates should sync instantly.

## 6. Put it on the internet (GitHub Pages)

1. Push this folder to your GitHub repo.
2. On GitHub, go to the repo → **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch** → branch `main` → folder `/ (root)` → **Save**.
4. After ~1 minute, GitHub will give you a URL like `https://parkerjameslow.github.io/Pillows/`.
5. Open that URL on your phone. Bookmark it.

That's it.

---

## How the app works

- **Tasks tab** — All duties grouped by phase (Pre / Setup / During / Take Down). Each task shows pay and a Simple Treasures (ST) or Holy Cow (HC) tag where relevant.
- **Tap a task** → A bottom sheet opens with everyone's name. Check who helped; the percentage splits evenly. You can override any % manually as long as the total stays at 100%.
- **Tap a completed task** → unmark it (removes its earnings from the totals).
- **Earnings tab** — Per-person totals, sorted highest first, plus an overall paid-out / remaining summary.
- **+ button (top right)** — Add a new ad-hoc task at any time.
