<?php
require __DIR__.'/../config/db.php';
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];

header('Content-Type: application/json');

// Helper to read JSON input
function json_input() {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}

// GET: Fetch all suppliers
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->query("SELECT id, name FROM suppliers ORDER BY name ASC");
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['suppliers' => $suppliers]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST: Add a new supplier
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_input();
    
    if (empty($data['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Supplier name is required']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO suppliers (name) VALUES (:name)");
        $stmt->execute([':name' => $data['name']]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// If method not allowed
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);