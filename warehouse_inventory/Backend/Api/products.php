<?php
require __DIR__.'/../config/db.php';
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

function require_auth() {
    if (empty($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error'=>'unauthenticated']);
        exit;
    }
}


function json_input() {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}

// GET all products or single by ID
if ($method === 'GET') {
    if (isset($_GET['id'])) {

        // Fetch product details + total stock + warehouses list (string)
        $stmt = $pdo->prepare('SELECT p.*, s.name AS supplier, COALESCE(SUM(i.quantity),0) AS total_stock, 
            GROUP_CONCAT(w.location SEPARATOR ", ") AS locations
            FROM products p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN inventory i ON i.product_id = p.id
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            WHERE p.id = :id
            GROUP BY p.id, s.name');
        $stmt->execute([':id' => $_GET['id']]);
        $product = $stmt->fetch() ?: [];

        // ✅ Fetch warehouse-wise quantity
        $warehouseStmt = $pdo->prepare('SELECT 
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                w.location,
                COALESCE(i.quantity, 0) AS quantity
            FROM warehouses w
            LEFT JOIN inventory i 
                ON i.warehouse_id = w.id 
                AND i.product_id = :id
            ORDER BY w.name');
        $warehouseStmt->execute([':id' => $_GET['id']]);
        $warehouses = $warehouseStmt->fetchAll();

        // ✅ merge both results
        $product['warehouses'] = $warehouses;

        echo json_encode($product);
        exit;
    }

    // Default GET → list all products
    $stmt = $pdo->query('SELECT p.sku,p.id, p.name, COALESCE(SUM(i.quantity),0) AS total_stock, p.price,p.acquire_cost,
        GROUP_CONCAT(w.location SEPARATOR ", ") AS locations
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN warehouses w ON i.warehouse_id = w.id
        GROUP BY p.id
        ORDER BY p.id ASC');

    echo json_encode($stmt->fetchAll());
    exit;
}
if ($method === 'GET' && preg_match('#/api/orders.php/new-number#', $path)) {
    $random = strtoupper(bin2hex(random_bytes(3))); // e.g. "A1B2C3"
    echo json_encode(['order_number' => 'ORD-' . $random]);
    exit;
}

// POST create product (admin only)
if ($method === 'POST') {
    require_auth();
    if ($_SESSION['user']['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error'=>'only admin can create products']);
        exit;
    }

    $data = json_input();
    if (empty($data['sku']) || empty($data['name'])) {
        http_response_code(400);
        echo json_encode(['error'=>'sku and name required']);
        exit;
    }

try {
    $pdo->beginTransaction();

    // 1️⃣ Insert product
    $sqlProd = 'INSERT INTO products (sku, name, description, supplier_id, acquire_cost, price)
                VALUES (:sku, :name, :description, :supplier_id, :acquire_cost, :price)';
    $stmtProd = $pdo->prepare($sqlProd);
    $stmtProd->execute([
        ':sku' => $data['sku'],
        ':name' => $data['name'],
        ':description' => $data['description'] ?? null,
        ':supplier_id' => $data['supplier_id'] ?? null,
        ':acquire_cost' => $data['acquire_cost'] ?? null,
        ':price' => $data['price'] ?? null
    ]);
    $productId = $pdo->lastInsertId(); // ✅ Get product ID

    // 2️⃣ Insert warehouse
    $sqlWh = 'INSERT INTO warehouses (name, location) VALUES (:name, :location)';
    $stmtWh = $pdo->prepare($sqlWh);
    $stmtWh->execute([
        ':name' => $data['warehouseName'] ?? 'Unknown',
        ':location' => $data['warehouseLocation'] ?? null
    ]);
    $warehouseId = $pdo->lastInsertId(); // ✅ Get warehouse ID

    // 3️⃣ Insert into inventory linking product and warehouse
    $sqlInv = 'INSERT INTO inventory (product_id, warehouse_id, quantity) 
               VALUES (:product_id, :warehouse_id, :quantity)';
    $stmtInv = $pdo->prepare($sqlInv);
    $stmtInv->execute([
        ':product_id' => $productId,
        ':warehouse_id' => $warehouseId,
        ':quantity' => $data['quantity'] ?? 0
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'product_id' => $productId,
        'warehouse_id' => $warehouseId
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}



    http_response_code(201);
    echo json_encode(['id'=>$pdo->lastInsertId()]);
    exit;
}

// PUT update product (admin only)
if ($method === 'PUT') {
    require_auth();
    if ($_SESSION['user']['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'only admin can edit products']);
        exit;
    }

    $input = file_get_contents('php://input');
    $put = [];

    // Try to parse JSON first
    $json = json_decode($input, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $put = $json;
    } else {
        parse_str($input, $put);
    }

    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id required']);
        exit;
    }

    $sql = 'UPDATE products  
            SET sku=:sku, name=:name, description=:description, supplier_id=:supplier_id, 
                acquire_cost=:acquire_cost, price=:price 
            WHERE id=:id';            
          
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':sku' => $put['sku'] ?? null,
        ':name' => $put['name'] ?? null,
        ':description' => $put['description'] ?? null,
        ':supplier_id' => $put['supplier_id'] ?? null,
        ':acquire_cost' => $put['acquire_cost'] ?? null,
        ':price' => $put['price'] ?? null,
        ':id' => $id
    ]);
    if (!empty($put['warehouse_id']) && isset($put['quantity'])) {
        $stmt2 = $pdo->prepare('UPDATE inventory 
                                SET quantity=:quantity  
                                WHERE product_id=:id AND warehouse_id=:warehouse_id');
        $stmt2->execute([
            ':quantity' => $put['quantity'],
            ':warehouse_id' => $put['warehouse_id'],
            ':id' => $id
        ]);
    }

    echo json_encode(['ok' => true]);
    exit;
}


// DELETE product (admin only)
if ($method === 'DELETE') {
    require_auth();
    if ($_SESSION['user']['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error'=>'only admin can delete products']);
        exit;
    }

    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }

    $stmt = $pdo->prepare('DELETE FROM products WHERE id=:id');
    $stmt->execute([':id'=>$id]);
    echo json_encode(['ok'=>true]);
    exit;
}

http_response_code(405);
echo json_encode(['error'=>'method not allowed']);
