<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: max-age=10, public'); // Short cache to prevent flood

// Database infintyfree connection details


$host = 'vistors-abolalh22-1ab4.i.aivencloud.com';
$db   = 'defaultdb';
$user = 'avnadmin';
$pass = 'AVNS_6Q-_oPFiBMaLH65LN5L';
$port = 16181;

//database local connection details

// $host = 'localhost';
// $db   = 'visitors';
// $user = 'root';
// $pass = '';

try {
    // Persistent connection to save connection overhead
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_PERSISTENT => true,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB err']);
    exit;
}

try {
    $last_id = isset($_GET['last_id']) ? (int)$_GET['last_id'] : 0;
    $before_id = isset($_GET['before_id']) ? (int)$_GET['before_id'] : 0;
    
    // Stats query - lightweight
    $statsStmt = $pdo->query("SELECT AVG(rating) as avg_r, COUNT(id) as total FROM reviews WHERE approved = 1");
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    $avg_rating = $stats['avg_r'] ? round($stats['avg_r'], 1) : 0;
    $total_reviews = $stats['total'] ? (int)$stats['total'] : 0;

    $reviews = [];
    
    // Get reviews: newest first for initial load, newer reviews for polling, older reviews for pagination
    if ($last_id > 0 && $before_id === 0) {
        $stmt = $pdo->prepare("SELECT id, subject_slug, rating, comment, created_at FROM reviews WHERE approved = 1 AND id > :last_id ORDER BY created_at DESC LIMIT 10");
        $stmt->execute(['last_id' => $last_id]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($before_id > 0) {
        $stmt = $pdo->prepare("SELECT id, subject_slug, rating, comment, created_at FROM reviews WHERE approved = 1 AND id < :before_id ORDER BY created_at DESC LIMIT 20");
        $stmt->execute(['before_id' => $before_id]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $stmt = $pdo->query("SELECT id, subject_slug, rating, comment, created_at FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT 20");
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Format the date for each review efficiently
    foreach ($reviews as &$rev) {
        $rev['formatted_date'] = substr($rev['created_at'], 0, 10); // Faster than DateTime
        $rev['student_name'] = 'Student #' . $rev['id'];
        $rev['comment'] = htmlspecialchars($rev['comment'] ?? '', ENT_QUOTES, 'UTF-8'); // XSS Protection
        unset($rev['created_at']); // save bandwidth
    }
    
    echo json_encode([
        'success' => true,
        'average_rating' => $avg_rating,
        'total_reviews' => $total_reviews,
        'reviews' => $reviews
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Err']);
}
?>
