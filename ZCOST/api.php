<?php
declare(strict_types=1);
if (function_exists('opcache_reset')) { @opcache_reset(); }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/app/SapClient.php';
require_once __DIR__ . '/app/AuditLog.php';
require_once __DIR__ . '/app/PortalAuth.php';

$client = new \App\SapClient();
$audit = new \App\AuditLog();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);

    if (!$payload || !is_array($payload)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON body provided in POST request'
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $action = (string)($payload['action'] ?? 'save');

    if ($action === 'audit') {
        \App\PortalAuth::requireLiveAdmin();
        $vbeln = trim((string)($payload['vbeln'] ?? ''));
        $limit = (int)($payload['limit'] ?? 40);
        echo json_encode([
            'success' => true,
            'data' => $audit->recent($limit, $vbeln !== '' ? $vbeln : null),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Unwrap if wrapped in { "data": ... } or { "d": ... }
    $dataToSave = $payload['data'] ?? ($payload['d'] ?? $payload);
    if (!is_array($dataToSave)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid save payload'
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $auditAction = !empty($dataToSave['Approve']) ? 'approve_save' : 'save';
    if ($action === 'approve') {
        $auditAction = 'approve_save';
    }

    // Approve is restricted to admin / nandhakumar
    $approveFlag = strtoupper(trim((string)($dataToSave['Approve'] ?? '')));
    if ($auditAction === 'approve_save' || $approveFlag === 'X') {
        if (!\App\PortalAuth::canApprove()) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Approve is allowed only for admin, and nandhakumar.',
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            exit;
        }
        $user = \App\PortalAuth::currentUser();
        $dataToSave['Approvedby'] = strtoupper((string)$user['username']);
        $dataToSave['Approve'] = 'X';
    }

    $result = $client->saveCostSheet($dataToSave);
    $auditEntry = $audit->logSave($dataToSave, is_array($result) ? $result : [], $auditAction);
    if (is_array($result)) {
        $result['audit'] = $auditEntry;
    }

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// GET handlers
$action = trim((string)($_GET['action'] ?? ''));
if ($action === 'session') {
    $user = \App\PortalAuth::currentUser();
    echo json_encode([
        'success' => true,
        'user' => $user,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
if ($action === 'audit') {
    \App\PortalAuth::requireLiveAdmin();
    $vbeln = trim((string)($_GET['vbeln'] ?? ''));
    $limit = (int)($_GET['limit'] ?? 40);
    echo json_encode([
        'success' => true,
        'data' => $audit->recent($limit, $vbeln !== '' ? $vbeln : null),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$vbeln = trim((string)($_GET['vbeln'] ?? $_POST['vbeln'] ?? ''));
$posnr = trim((string)($_GET['posnr'] ?? $_POST['posnr'] ?? '000010'));
$create = isset($_GET['create']) && ($_GET['create'] === '1' || $_GET['create'] === 'true')
       || (isset($_GET['action']) && $_GET['action'] === 'create')
       || (isset($_POST['action']) && $_POST['action'] === 'create');

if (empty($posnr)) {
    $posnr = '000010';
}

if ($create) {
    $result = $client->createQuotationMaster((string)$vbeln, (string)$posnr);
} else {
    $result = $client->getCostSheet((string)$vbeln, (string)$posnr);
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
