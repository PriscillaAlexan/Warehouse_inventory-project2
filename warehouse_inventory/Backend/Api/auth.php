<?php
session_start();
require __DIR__ . '/../config/db.php'; // your PDO connection

header('Content-Type: application/json');

// Get HTTP method and task
$method = $_SERVER['REQUEST_METHOD'];
$task = $_GET['task'] ?? '';

// Helper: read JSON body
function require_json() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

// ===== LOGIN =====
if ($method === 'POST' && $task === 'login') {
    $data = require_json();
    $username = isset($data['username']) && is_string($data['username']) ? trim($data['username']) : '';
    $password = isset($data['password']) && is_string($data['password']) ? $data['password'] : '';


    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error'=>'username and password required']);
        exit;
    }

    // Query user by username only
    $stmt = $pdo->prepare('SELECT id, username, password_hash, role FROM users WHERE username = :u');
    $stmt->execute([':u' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user'] = ['id'=>$user['id'], 'username'=>$user['username'], 'role'=>$user['role']];
        echo json_encode(['ok'=>true, 'user'=>$_SESSION['user']]);
        exit;
    } else {
        http_response_code(401);
        echo json_encode(['error'=>'invalid credentials']);
        exit;
    }
}


// ===== LOGOUT =====
if ($method === 'POST' && $task === 'logout') {
    session_destroy();
    echo json_encode(['ok' => true]);
    exit;
}

// ===== GET CURRENT USER =====
if ($method === 'GET' && $task === 'me') {
    echo json_encode(['user' => $_SESSION['user'] ?? null]);
    exit;
}

// ===== DEFAULT 405 =====
http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
