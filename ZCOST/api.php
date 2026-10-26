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
$client = new \App\SapClient();

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

    // Unwrap if wrapped in { "data": ... } or { "d": ... }
    $dataToSave = $payload['data'] ?? ($payload['d'] ?? $payload);
    $result = $client->saveCostSheet($dataToSave);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// GET or POST query parameter handler
$vbeln = trim((string)($_GET['vbeln'] ?? $_POST['vbeln'] ?? ''));
$posnr = trim((string)($_GET['posnr'] ?? $_POST['posnr'] ?? '000010'));
$cache = isset($_GET['cache']) && ($_GET['cache'] === '1' || $_GET['cache'] === 'true');
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


