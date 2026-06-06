<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Database infintyfree connection details

$host = 'vistors-abolalh22-1ab4.i.aivencloud.com';
$db   = 'defaultdb';
$user = 'avnadmin';
$pass = 'AVNS_6Q-_oPFiBMaLH65LN5L';
$port = 16181;

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // معالجة الخطأ
}

$conn = new mysqli($host, $user, $pass, $db, $port);
if ($conn->connect_error) {
    echo json_encode(['c' => 0]);
    exit;
}


// For production, the database and table are assumed to exist to reduce server load
// If first time setup is needed, run the SQL manually once.

if (!isset($_SESSION['visited'])) {
    $conn->query("UPDATE visitor_count SET total_count = total_count + 1 WHERE id = 1");
    $_SESSION['visited'] = true;
    echo json_encode(['s' => 1]); // 1 for new
} else {
    echo json_encode(['s' => 2]); // 2 for returning
}

$conn->close();
?>
