# JK Chicken Care — Customer Order Portal

A starter full-stack app: customers log in, request chicken orders, and the
admin (you) reviews requests against live stock and accepts or rejects them.

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`), JWT login
- **Frontend:** React (Vite)

## Folder structure

```
jk-first-app/
  server/     Express API + SQLite database
  client/     React frontend
```

## 1. Run the backend

Open a terminal in the `server` folder:

```powershell
cd server
npm install
npm run dev
```

This starts the API at **http://localhost:4000** and automatically creates
`chicken_care.db` (SQLite file) with:
- a default admin account: **admin@jk.com / admin123**
- starting stock of **100 chickens**

Keep this terminal window open and running.

## 2. Run the frontend

Open a **second** terminal in the `client` folder:

```powershell
cd client
npm install
npm run dev
```

This starts the React app, usually at **http://localhost:5173** — open that
in your browser.

## 3. Try it out

1. Go to the app, click **"Create a customer account"**, and register.
2. Sign in as that customer and submit an order request.
3. Sign out, then sign in as the admin (`admin@jk.com` / `admin123`).
4. You'll see the pending request — **Accept** it (this reduces stock) or
   **Reject** it.
5. Sign back in as the customer to see the order status update.

## Notes for later

- Change `JWT_SECRET` in `server/middleware/auth.js` (or set it via a `.env`
  file) before this ever goes near a real deployment.
- The admin account is currently the only account with `role = 'admin'` in
  the database — you can promote other users by editing the `users` table
  directly if needed.
- This project lives in a OneDrive-synced folder. If you notice syncing lag
  once `node_modules` grows, consider moving development work to a local,
  non-synced folder (e.g. `C:\Projects`).
