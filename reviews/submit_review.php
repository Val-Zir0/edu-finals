<?php
header('Content-Type: application/json; charset=utf-8');

// Include bad words filter
require_once 'badwords.php';

// Secret key for HMAC - Must match generate_token.php
define('REVIEW_TOKEN_SECRET', 'mY_sEcReT_kEy_123!@#_visitors_token');

// Allowed subjects whitelist
$allowedSubjects = [
    'legacy',
    '3olom-syaseya',
    'maharat-etsal',
    'solook-tanzemy'
];

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
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get JSON input
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
        exit;
    }
    
    $rating = isset($input['rating']) ? (int)$input['rating'] : 0;
    $comment = isset($input['comment']) ? trim($input['comment']) : '';
    $subject = isset($input['subject']) ? trim($input['subject']) : 'legacy';
    $token = isset($input['token']) ? trim($input['token']) : '';
    $device_fingerprint = isset($input['fingerprint']) ? substr(trim($input['fingerprint']), 0, 128) : null;
    
    // Get real user IP address
    $user_ip = '';
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $user_ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ipList = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $user_ip = trim(end($ipList));
    } else {
        $user_ip = $_SERVER['REMOTE_ADDR'] ?? '';
    }

    // Function to log abuse
    $logAbuse = function($reason) use ($pdo, $user_ip) {
        try {
            $stmt = $pdo->prepare("INSERT INTO review_abuse_logs (ip_address, reason) VALUES (:ip, :reason)");
            $stmt->execute([':ip' => $user_ip, ':reason' => $reason]);
        } catch (PDOException $e) { /* ignore if table not created */ }
        error_log("Spam/Abuse Blocked: {$reason} - IP {$user_ip}");
    };

    // Check block status first
    try {
        $stmtHour = $pdo->prepare("SELECT COUNT(*) FROM review_abuse_logs WHERE ip_address = :ip AND attempt_time >= NOW() - INTERVAL 1 HOUR");
        $stmtHour->execute([':ip' => $user_ip]);
        $fails1Hour = (int)$stmtHour->fetchColumn();

        $stmt15Min = $pdo->prepare("SELECT COUNT(*) FROM review_abuse_logs WHERE ip_address = :ip AND attempt_time >= NOW() - INTERVAL 15 MINUTE");
        $stmt15Min->execute([':ip' => $user_ip]);
        $fails15Min = (int)$stmt15Min->fetchColumn();

        if ($fails1Hour >= 10 || $fails15Min >= 5) {
            http_response_code(429);
            echo json_encode(['success' => false, 'message' => 'تم حظرك مؤقتاً لمحاولاتك المتكررة. يرجى المحاولة لاحقاً.']);
            exit;
        }
    } catch (PDOException $e) { /* ignore */ }

    // Validate Token
    if (empty($token)) {
        $logAbuse('Missing Token');
        echo json_encode(['success' => false, 'message' => 'الطلب غير صالح. يرجى إعادة المحاولة.']);
        exit;
    }

    $tokenParts = explode('.', $token);
    if (count($tokenParts) !== 2) {
        $logAbuse('Malformed Token');
        echo json_encode(['success' => false, 'message' => 'الطلب غير صالح.']);
        exit;
    }

    $payloadEncoded = $tokenParts[0];
    $signatureProvided = $tokenParts[1];
    
    $expectedSignature = hash_hmac('sha256', $payloadEncoded, REVIEW_TOKEN_SECRET);
    if (!hash_equals($expectedSignature, $signatureProvided)) {
        $logAbuse('Invalid Token Signature');
        echo json_encode(['success' => false, 'message' => 'فشل التحقق من صحة الطلب.']);
        exit;
    }

    $payloadDecoded = base64_decode(str_replace(['-', '_'], ['+', '/'], $payloadEncoded));
    $tokenData = json_decode($payloadDecoded, true);

    if (!$tokenData || !isset($tokenData['exp']) || !isset($tokenData['ip'])) {
        $logAbuse('Invalid Token Payload');
        echo json_encode(['success' => false, 'message' => 'الطلب غير صالح.']);
        exit;
    }

    if (time() > $tokenData['exp']) {
        $logAbuse('Expired Token');
        echo json_encode(['success' => false, 'message' => 'انتهت صلاحية الجلسة، يرجى تحديث الصفحة.']);
        exit;
    }

    if ($tokenData['ip'] !== $user_ip) {
        $logAbuse('Token IP Mismatch');
        echo json_encode(['success' => false, 'message' => 'تم رصد محاولة عبث.']);
        exit;
    }
    
    // Subject Validation
    if (!in_array($subject, $allowedSubjects)) {
        $logAbuse('Invalid Subject: ' . $subject);
        echo json_encode(['success' => false, 'message' => 'معلومات التقييم غير صالحة.']);
        exit;
    }

    // Comment Length Protection
    if (mb_strlen($comment, 'UTF-8') > 500) {
        $logAbuse('Comment Length Exceeded');
        echo json_encode(['success' => false, 'message' => 'عذراً، لا يمكن أن يتجاوز التعليق 500 حرف.']);
        exit;
    }
    
    // Check for previous review for this subject (lifetime)
    try {
        $stmtCheck = $pdo->prepare("
            SELECT id FROM reviews 
            WHERE device_fingerprint = :fingerprint 
            AND device_fingerprint IS NOT NULL 
            AND device_fingerprint != ''
            AND subject_slug = :subject
            LIMIT 1
        ");
        $stmtCheck->execute([
            ':fingerprint' => $device_fingerprint,
            ':subject' => $subject
        ]);
        if ($stmtCheck->fetch()) {
            $logAbuse('Review flooding attempt (24h)');
            echo json_encode(['success' => false, 'message' => 'لقد قمت بالتقييم مسبقاً، شكراً لمشاركتك.']);
            exit;
        }
    } catch (PDOException $e) {
        // If the ip_address column doesn't exist yet, this will catch the error gracefully
    }
    
    // Validate rating
    if ($rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'التقييم غير صحيح. يجب أن يكون بين 1 و 5.']);
        exit;
    }

    // Require 10 chars minimum for 3 stars or less
    if ($rating <= 3 && mb_strlen($comment, 'UTF-8') < 10) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'عذراً، يجب أن يحتوي سبب التقييم على 10 أحرف على الأقل.']);
        exit;
    }
    
    // Check for bad words
    if (!empty($comment) && containsBadWords($comment)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'يرجى الالتزام بالألفاظ المناسبة. لم يتم حفظ التقييم.']);
        exit;
    }
    
    // Insert into database
    try {
        $stmt = $pdo->prepare("INSERT INTO reviews (subject_slug, rating, comment, ip_address, device_fingerprint) VALUES (:subject, :rating, :comment, :ip_address, :fingerprint)");
        $stmt->execute([
            ':subject' => $subject,
            ':rating' => $rating,
            ':comment' => $comment,
            ':ip_address' => $user_ip,
            ':fingerprint' => $device_fingerprint
        ]);
        
        $newId = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true, 
            'message' => 'تم استلام تقييمك بنجاح. شكراً لك!',
            'review_id' => $newId
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'حدث خطأ أثناء حفظ التقييم.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
?>
