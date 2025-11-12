-- seed_data.sql
USE warehouse;

-- users (password: demo123) -- change in production
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2y$10$ceuYkGR.HZ89vPdo2yCYbO5gkb4HxplkqhliA6/dfpjkHjzY3Hro.', 'admin'); 
-- password_hash is password_hash('demo123', PASSWORD_DEFAULT)

INSERT INTO suppliers (name, contact_email, phone) VALUES
('Acme Supplies','sales@acme.local','+92-300-0000001'),
('Global Parts','contact@global.local','+92-300-0000002');

INSERT INTO products (sku, name, description, supplier_id, aquire_cost DECIMAL(10,2),
, price) VALUES
('SKU-001','Box (Small)','Small cardboard box',1,1.00,2.50),
('SKU-002','Tape (Packing)','Packing tape 48mm',2,2.00,4.50),
('SKU-003','Bubble Wrap','Protective bubble wrap',1,3.00,6.00);

INSERT INTO warehouses (name, location) VALUES
('Main Warehouse','Karachi'),
('Secondary Warehouse','Lahore');

INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES
(1,1,100),(1,2,40),(2,1,200),(3,1,50);

-- sample order
INSERT INTO orders (order_number, customer_name) VALUES ('ORD-1001','Customer A');
INSERT INTO order_items (order_id, product_id, qty) VALUES (LAST_INSERT_ID(), 1, 5);
