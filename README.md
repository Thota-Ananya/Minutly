# Minutly - Smart Substitutes (Full-Stack)

A quick-commerce grocery website where the **customer chooses a backup item in advance**. If something runs out while the packer is packing, the app uses the customer's choice automatically.

**Tech:** Node.js + Express (backend), MongoDB Atlas (database), plain HTML/CSS/JavaScript (frontend).
One server serves both the website and the API, so deploying is simple.

## What users can do

**Customers**
- Sign up and log in
- Browse groceries, search, filter by category
- Add to basket and pick a backup item (or "refund") for every product
- Enter delivery address and place an order (Cash on Delivery)
- Track the order live (page refreshes by itself) and cancel before packing starts

**Staff / Packer** (separate login)
- See new orders arrive automatically
- Press **Packed** or **Out of stock** for each item
- When an item is out of stock, the customer's choice is applied automatically (backup item or refund)
- Complete orders, change stock numbers (Inventory tab)
- **Analytics** page with real numbers: fill rate, complete baskets, stockouts saved by backups, revenue

## Business rules
- A backup must be in the same group (e.g. 1 L milk can only be replaced by another 1 L milk).
- A backup can never cost more than the original, so the final bill can only go down.
- If the backup is also out of stock, the item is removed from the bill.
- Stock is reserved when the order is placed and given back if the order is cancelled.

## Folder map
```
server.js          starts the website + API
seed.js            adds the 24 starter products + staff account (runs automatically)
models/            database shapes: User, Product, Order
routes/            API: auth.js, products.js, orders.js (customer), staff.js (packer)
middleware/        login checks
utils/             business rules (substitute rule, totals)
public/            the website: pages (.html), css/, js/
```

## Run on your computer
1. Install Node.js 18 or newer.
2. Open a terminal in this folder and run: `npm install`
3. Copy `.env.example` to a new file named `.env` and fill in `MONGODB_URI` and `JWT_SECRET`.
4. Run: `npm start`
5. Open http://localhost:3000

Default staff login (from your `.env`): `packer@minutly.local` / `ChangeMe@12345`. Change these.

## Deploy on Render (Web Service)
1. Upload all these files to your GitHub repo (replace the old files). **Do not upload `.env` or `node_modules`.**
2. In MongoDB Atlas: Network Access, allow `0.0.0.0/0`. Copy your connection string and add the database name `minutly` before the `?`.
3. In Render: **New, Web Service**, pick the repo.
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: Free
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = a long random text (30+ characters)
   - `STAFF_EMAIL` = your packer login email
   - `STAFF_PASSWORD` = a strong password (8+ characters)
5. Click **Create Web Service**. When the log says "Minutly running on port...", open your link.

Render's free Web Service goes to sleep after about 15 minutes without visitors. The first visit after that takes about a minute to wake up.

## Security built in
Passwords are hashed (bcrypt). Login uses an httpOnly cookie. Rate limiting on login/signup. Security headers (helmet). CSRF protection with a custom header. All input is validated on the server, and all text is escaped before display. Prices and totals are always calculated on the server, never trusted from the browser.

## Not included yet (ideas for next steps)
- Online payments (add Razorpay or Stripe)
- Email / SMS order notifications and password reset
- Product images and an admin screen to add new products
- Delivery rider tracking
