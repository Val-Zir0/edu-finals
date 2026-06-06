<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // adjust if needed
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// Secret key for HMAC - should ideally be in a secure config file or env var
define('REVIEW_TOKEN_SECRET', 'mY_sEcReT_kEy_123!@#_visitors_token');


// Database infintyfree connection details


$host = 'vistors-abolalh22-1ab4.i.aivencloud.com';
$db   = 'defaultdb';
$user = 'avnadmin';
$pass = 'AVNS_6Q-_oPFiBMaLH65LN5L';
$port = 16181;

// Database local connection details (Adjusted to match submit_review.php)

// $host = 'localhost';
// $db   = 'visitors';
// $user = 'root';
// $pass = '';

function getUserIP() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ipList = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        // The last IP is added by the actual proxy, preventing spoofing
        return trim(end($ipList));
    } else {
        return $_SERVER['REMOTE_ADDR'] ?? '';
    }
}

$user_ip = getUserIP();
$device_fingerprint = isset($_GET['fp']) ? substr(trim($_GET['fp']), 0, 128) : null;
$subject = isset($_GET['subject']) ? trim($_GET['subject']) : 'legacy';

$allowedSubjects = [
    'legacy',
    '3olom-syaseya',
    'maharat-etsal',
    'solook-tanzemy'
];

if (!in_array($subject, $allowedSubjects, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid Subject']);
    exit;
}

// Check if IP is currently blocked
try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Block logic: 10 fails in 1 hour, or 5 fails in 15 minutes
    $stmtHour = $pdo->prepare("SELECT COUNT(*) FROM review_abuse_logs WHERE ip_address = :ip AND attempt_time >= NOW() - INTERVAL 1 HOUR");
    $stmtHour->execute([':ip' => $user_ip]);
    $fails1Hour = (int)$stmtHour->fetchColumn();

    $stmt15Min = $pdo->prepare("SELECT COUNT(*) FROM review_abuse_logs WHERE ip_address = :ip AND attempt_time >= NOW() - INTERVAL 15 MINUTE");
    $stmt15Min->execute([':ip' => $user_ip]);
    $fails15Min = (int)$stmt15Min->fetchColumn();

    // Permanent Ban for extreme abuse (> 50 total fails)
    $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM review_abuse_logs WHERE ip_address = :ip");
    $stmtTotal->execute([':ip' => $user_ip]);
    $totalFails = (int)$stmtTotal->fetchColumn();

    if ($totalFails >= 20 || $fails1Hour >= 10 || $fails15Min >= 5) {
        http_response_code(429); // Too Many Requests
        echo json_encode(['success' => false, 'message' => 'PERMANENT_BAN']);
        exit;
    }

    // Check if user already rated this subject
    $stmtRate = $pdo->prepare("
        SELECT id FROM reviews 
        WHERE device_fingerprint = :fingerprint 
        AND device_fingerprint IS NOT NULL 
        AND device_fingerprint != ''
        AND subject_slug = :subject
        LIMIT 1
    ");
    $stmtRate->execute([
        ':fingerprint' => $device_fingerprint,
        ':subject' => $subject
    ]);
    if ($stmtRate->fetch()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'ALREADY_RATED']);
        exit;
    }

} catch (PDOException $e) {
    // Graceful fallback if tables don't exist yet
}

// Generate token
$expiration = time() + 900; // 15 minutes from now
$payload = json_encode([
    'ip' => $user_ip,
    'exp' => $expiration
]);

// Base64Url encode
$payloadEncoded = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
$signature = hash_hmac('sha256', $payloadEncoded, REVIEW_TOKEN_SECRET);

$token = $payloadEncoded . '.' . $signature;

echo json_encode(['success' => true, 'token' => $token]);
?>
