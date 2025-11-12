<?php
require __DIR__ . '/../config/db.php';
function require_auth() {
    if (empty($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error'=>'unauthenticated']);
        exit;
    }
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

try {
    // Fetch all warehouses with total stock
    $stmt = $pdo->query('
        SELECT 
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            w.location,
            COALESCE(SUM(i.quantity), 0) AS quantity
        FROM warehouses w
        LEFT JOIN inventory i ON i.warehouse_id = w.id
        GROUP BY w.id
        ORDER BY w.name ASC
    ');

    $warehouses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($warehouses);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch warehouses: ' . $e->getMessage()]);
}
