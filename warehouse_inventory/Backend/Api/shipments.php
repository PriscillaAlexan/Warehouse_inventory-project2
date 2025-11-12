<?php
require __DIR__ . '/../config/db.php';


$method = $_SERVER['REQUEST_METHOD'];

function require_auth() {
    if (empty($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error' => 'unauthenticated']);
        exit;
    }
}

function json_input() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

/* ------------------- CREATE SHIPMENT ------------------- */
if ($method === 'POST') {
    require_auth();
    $data = json_input();

    if (empty($data['shipment_type']) || (empty($data['warehouse_id']) && empty($data['warehouseName'])) || empty($data['items'])) {
        http_response_code(400);
        echo json_encode(['error' => 'shipment_type, warehouse, and items are required']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // INSERT NEW WAREHOUSE IF NEEDED
        if (empty($data['warehouse_id']) && !empty($data['warehouseName'])) {
            $stmt = $pdo->prepare("INSERT INTO warehouses (name, location) VALUES (:name, :location)");
            $stmt->execute([
                ':name' => $data['warehouseName'],
                ':location' => $data['warehouseLocation'] ?? null
            ]);
            $data['warehouse_id'] = $pdo->lastInsertId();
        }

        // VALIDATE WAREHOUSE EXISTS
        $stmtCheck = $pdo->prepare("SELECT id FROM warehouses WHERE id = :id");
        $stmtCheck->execute([':id' => $data['warehouse_id']]);
        if (!$stmtCheck->fetch()) {
            throw new Exception("Warehouse does not exist.");
        }

        // INSERT SHIPMENT
        $stmt = $pdo->prepare("INSERT INTO shipments 
            (shipment_type, warehouse_id, reference) VALUES (:type, :wid, :ref)");
        $stmt->execute([
            ':type' => $data['shipment_type'],
            ':wid' => $data['warehouse_id'],
            ':ref' => $data['reference'] ?? null
        ]);
        $shipmentId = $pdo->lastInsertId();

        // Prepare statements
        $insertItem = $pdo->prepare("INSERT INTO shipment_items (shipment_id, product_id, qty) VALUES (:sid, :pid, :qty)");
        $invUp = $pdo->prepare("INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (:pid, :wid, :qty) 
            ON DUPLICATE KEY UPDATE quantity = quantity + :qty");
        $invDown = $pdo->prepare("UPDATE inventory SET quantity = quantity - :qty WHERE product_id = :pid AND warehouse_id = :wid");

        foreach ($data['items'] as &$item) {
            // INSERT NEW PRODUCT IF NEEDED
           if (empty($item['product_id']) && !empty($item['name'])) {
                $stmtProd = $pdo->prepare("
                    INSERT INTO products (sku, name, supplier_id, acquire_cost, price) 
                    VALUES (:sku, :name, :supplier_id, :acquire_cost, :price)
                ");
                $stmtProd->execute([
                    ':sku' => $item['sku'] ?? 'SKU-' . mt_rand(100000, 999999),
                    ':name' => $item['name'],
                    ':supplier_id' => $item['supplier_id'] ?? null,
                    ':acquire_cost' => $item['acquire_cost'] ?? 0,
                    ':price' => $item['price'] ?? 0
                ]);
                $item['product_id'] = $pdo->lastInsertId();
            }

            if (!isset($item['product_id'], $item['qty']) || (int)$item['qty'] <= 0) {
                throw new Exception('Invalid item.');
            }

            // INSERT INTO shipment_items
            $insertItem->execute([
                ':sid' => $shipmentId,
                ':pid' => $item['product_id'],
                ':qty' => $item['qty']
            ]);

            // UPDATE INVENTORY
            if ($data['shipment_type'] === 'IN') {
                $invUp->execute([
                    ':pid' => $item['product_id'],
                    ':wid' => $data['warehouse_id'],
                    ':qty' => $item['qty']
                ]);
            } else { // OUT
                $s = $pdo->prepare("SELECT quantity FROM inventory WHERE product_id = :pid AND warehouse_id = :wid FOR UPDATE");
                $s->execute([':pid' => $item['product_id'], ':wid' => $data['warehouse_id']]);
                $row = $s->fetch();
                $available = $row ? (int)$row['quantity'] : 0;
                if ($available < $item['qty']) {
                    throw new Exception('Insufficient stock for product ID ' . $item['product_id']);
                }
                $invDown->execute([
                    ':pid' => $item['product_id'],
                    ':wid' => $data['warehouse_id'],
                    ':qty' => $item['qty']
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(['ok' => true, 'shipment_id' => $shipmentId]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Failed to create shipment: ' . $e->getMessage()]);
    }
    exit;
}

/* ------------------- GET ALL SHIPMENTS ------------------- */
if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT 
            s.id,
            s.shipment_type,
            s.reference,
            s.created_at,
            w.name AS warehouse,
            COALESCE(SUM(si.qty), 0) AS total_items,
            p.name AS products
        FROM shipments s
        JOIN warehouses w ON s.warehouse_id = w.id
        LEFT JOIN shipment_items si ON s.id = si.shipment_id
        LEFT JOIN products p ON si.product_id = p.id
        GROUP BY s.id
        ORDER BY s.created_at asc
    ");
    $shipments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($shipments);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
