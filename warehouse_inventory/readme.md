# Warehouse Inventory Management SPA

A Single Page Application (SPA) to manage warehouse inventory, products, orders, shipments, and users. Built with **HTML, CSS, JS (frontend)** and **PHP/MySQL (backend)**.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Backend Structure](#backend-structure)
4. [Frontend Structure](#frontend-structure)
5. [Database Design](#database-design)
6. [Setup Instructions](#setup-instructions)
7. [User Guide](#user-guide)
8. [API Endpoints](#api-endpoints)

---

## Project Overview

This project simplifies warehouse operations by enabling users to:

* Manage products across multiple warehouses
* Track inventory and stock levels
* Handle orders and order items
* Create shipments (inbound/outbound)
* Authenticate users with roles (admin/user)

---

## Features

* **Dashboard:** View recent products, orders, and shipments
* **Products Page:** CRUD operations with warehouse inventory tracking
* **Orders Page:** Create and delete orders with stock validation
* **Shipments Page:** Create shipments with products linked to warehouses
* **Authentication:** Login/logout with session tracking

---

## Backend Structure

```
backend/
├─ api/
│  ├─ products.php       # Manage products (CRUD + stock)
│  ├─ orders.php         # Manage orders and order items
│  ├─ shipments.php      # Manage shipments and shipment items
│  ├─ users.php          # Authentication (login/logout)
│  ├─ suppliers.php      # Manage suppliers
├─ config/
│  └─ db.php             # Database connection
```

**Highlights:**

* Each API uses `require_auth()` to secure access
* Prepared statements prevent SQL injection
* Handles many-to-many relationships (products ↔ warehouses via inventory)
* Key operations in APIs:

  * `products.php`: GET, POST, PUT, DELETE
  * `orders.php`: GET, POST, DELETE
  * `shipments.php`: GET, POST, DELETE
  * `suppliers.php`: GET, POST, PUT, DELETE

---

## Frontend Structure

```
frontend/
├─ index.html            # Main SPA layout
├─ css/
│  └─ style.css          # Styles for SPA, forms, tables, buttons
├─ js/
│  └─ app.js             # SPA logic, API calls, view rendering
```

**Key Features:**

* **Dashboard:** Displays recent products, orders, shipments
* **Products Page:** Add/Edit/Delete products and manage stock
* **Orders Page:** Create/delete orders with stock validation
* **Shipments Page:** Add shipments with product selection
* **Authentication:** Login/logout session handling

---

## Database Design

### Overview

The database manages all warehouse operations:

* Products
* Warehouses
* Inventory (per warehouse)
* Suppliers
* Orders & Order Items
* Shipments & Shipment Items
* Users (authentication)

### Tables

| Table          | Description                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Warehouses     | id, name, location                                                                                               |
| Products       | id, sku, name, description, acquire_cost, price, supplier_id                                                     |
| Suppliers      | id, name, contact_email, phone                                                                                   |
| Inventory      | id, product_id, warehouse_id, quantity                                                                           |
| Orders         | id, order_number, customer_name, status, created_at                                                              |
| Order Items    | id, order_id, product_id, qty                                                                                    |
| Shipments      | id, shipment_type, warehouse_id, reference, shipper_name, receiver_name, origin, destination, weight, created_at |
| Shipment Items | id, shipment_id, product_id, qty                                                                                 |
| Users          | id, username, password_hash, role                                                                                |

### Relationships & Joins

* **Products ↔ Inventory ↔ Warehouses** (Many-to-Many)

```sql
SELECT p.id, p.name, COALESCE(SUM(i.quantity),0) AS total_stock
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
GROUP BY p.id;
```

* **Orders ↔ Order Items ↔ Products** (One-to-Many)

```sql
SELECT o.order_number, p.name, oi.qty
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;
```

* **Shipments ↔ Shipment Items ↔ Products & Warehouses**

```sql
SELECT s.id, s.shipment_type, w.name AS warehouse, p.name AS product, si.qty
FROM shipments s
JOIN shipment_items si ON s.id = si.shipment_id
JOIN products p ON si.product_id = p.id
JOIN warehouses w ON s.warehouse_id = w.id;
```

* **Suppliers ↔ Products** (One-to-Many)

---

## Setup Instructions

1. **Clone the repository**

```bash
git clone <repo-url>
cd warehouse-inventory
```

2. **Import Database**

```sql
mysql -u username -p < schema.sql
```

3. **Configure Backend**

* Update `backend/config/db.php` with your MySQL credentials

4. **Run PHP Server**

```bash
php -S localhost:8000 -t backend
```

5. **Open Frontend**

* Open `frontend/index.html` in a browser

---

## User Guide

### Login

* Click **Login** in the top-right
* Enter your username and password
* Only authorized users can access product/order/shipment management

### Dashboard

* Shows summaries of recent products, orders, shipments

### Products

* **Add Product:** Click `New` → fill details → save
* **Edit Product:** Click `Edit` → update details → save
* **Delete Product:** Click `Delete`
* **Stock Management:** Update quantities per warehouse

### Orders

* **Add Order:** Click `New` → select products and quantity → save
* **Delete Order:** Click `Delete`

### Shipments

* **Add Shipment:** Click `New` → select type (IN/OUT), warehouse, products → save
* **Delete Shipment:** Click `Delete`

---

## API Endpoints (Summary)

| Endpoint             | Method              | Description                       |
| -------------------- | ------------------- | --------------------------------- |
| `/api/products.php`  | GET/POST/PUT/DELETE | Manage products & inventory       |
| `/api/orders.php`    | GET/POST/DELETE     | Manage orders & order items       |
| `/api/shipments.php` | GET/POST/DELETE     | Manage shipments & shipment items |
| `/api/users.php`     | POST                | Login / Logout                    |
| `/api/suppliers.php` | GET/POST/PUT/DELETE | Manage suppliers                  |
