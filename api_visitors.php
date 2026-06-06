<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: max-age=15, public'); // Allow caching for 15s to reduce server load

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

// Minimal query - assuming table and row exist
$result = $conn->query("SELECT total_count FROM visitor_count WHERE id = 1 LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $count = $row['total_count'];
} else {
    $count = 0;
}

echo json_encode(['c' => $count]);
$conn->close();
?>