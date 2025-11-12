<?php
// backend/api/orders.php
require __DIR__.'/../config/db.php';
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];
if ($method === 'GET' && preg_match('#orders\.php/new-number$#', $path)) {
    $random = strtoupper(bin2hex(random_bytes(3))); // e.g. "A1B2C3"
    echo json_encode(['order_number' => 'ORD-' . $random]);
    exit;
}
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

if ($method === 'GET' && preg_match('#/api/orders.php/new-number#', $path)) {
    $random = strtoupper(bin2hex(random_bytes(3))); // e.g. "A1B2C3"
    echo json_encode(['order_number' => 'ORD-' . $random]);
    exit;
}
/* ------------------- CREATE ORDER ------------------- */
if ($method === 'POST' && preg_match('#orders\.php$#', $path)) {
    require_auth();
    $data = json_input();

    if (empty($data['order_number']) || empty($data['items']) || !is_array($data['items'])) {
        http_response_code(400);
        echo json_encode(['error'=>'order_number and items required']);
        exit;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO orders (order_number, customer_name) VALUES (:order_number, :customer_name)');
        $stmt->execute([
            ':order_number'=>$data['order_number'],
            ':customer_name'=>$data['customer_name'] ?? null
        ]);

        $orderId = $pdo->lastInsertId();

        $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, qty) VALUES (:order_id, :product_id, :qty)');
        foreach ($data['items'] as $it) {
            if (!isset($it['product_id'], $it['qty']) || (int)$it['qty'] <= 0) {
                throw new Exception('Invalid item');
            }

            $itemStmt->execute([
                ':order_id'=>$orderId,
                ':product_id'=>$it['product_id'],
                ':qty'=>$it['qty']
            ]);
        }

        $pdo->commit();
        http_response_code(201);
        echo json_encode(['order_id'=>$orderId]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error'=>'Failed to create order: '.$e->getMessage()]);
    }

    exit;
}

/* ------------------- GET ORDER DETAILS ------------------- */
if ($method === 'GET' && isset($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = :id');
    $stmt->execute([':id'=>$_GET['id']]);
    $order = $stmt->fetch();

    if (!$order) {
        echo json_encode([]);
        exit;
    }

    $items = $pdo->prepare('
        SELECT oi.qty, p.sku, p.name 
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = :id
    ');
    $items->execute([':id'=>$_GET['id']]);
    $order['items'] = $items->fetchAll();

    echo json_encode($order);
    exit;
}

/* ------------------- LIST ORDERS ------------------- */
if ($method === 'GET') {
    $stmt = $pdo->query('
        SELECT 
            o.id,
            o.order_number,
            o.customer_name,
            o.status,
            o.created_at,
            COALESCE(SUM(oi.qty), 0) AS total_items,
            GROUP_CONCAT(p.name SEPARATOR ", ") AS products
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    ');

    echo json_encode($stmt->fetchAll());
    exit;
}

/* ------------------- DELETE ORDER ------------------- */
if ($method === 'DELETE' && isset($_GET['id'])) {
    require_auth();

    // Only admins can delete
    if ($_SESSION['user']['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden - admin only']);
        exit;
    }

    $orderId = (int) $_GET['id'];

    try {
        $pdo->beginTransaction();

        // Delete related order items first
        $pdo->prepare('DELETE FROM order_items WHERE order_id = :id')
            ->execute([':id' => $orderId]);

        // Delete the order itself
        $pdo->prepare('DELETE FROM orders WHERE id = :id')
            ->execute([':id' => $orderId]);

        $pdo->commit();

        echo json_encode(['ok' => true, 'deleted_order' => $orderId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete order: ' . $e->getMessage()]);
    }

    exit;
}

http_response_code(405);
echo json_encode(['error'=>'method not allowed']);
