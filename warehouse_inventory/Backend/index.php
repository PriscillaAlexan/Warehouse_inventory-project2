<?php
// backend/index.php
require __DIR__ . '/config/db.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // adjust in production
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (preg_match('#^/api/auth#', $uri)) {
    require __DIR__ . '/api/auth.php';
    exit;
}
if (preg_match('#^/api/products#', $uri)) {
    require __DIR__ . '/api/products.php';
    exit;
}
if (preg_match('#^/api/orders#', $uri)) {
    require __DIR__ . '/api/orders.php';
    exit;
}
if (preg_match('#^/api/shipments#', $uri)) {
    require __DIR__ . '/api/shipments.php';
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);
