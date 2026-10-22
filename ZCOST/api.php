<?php
declare(strict_types=1);

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

// GET Handler
$vbeln = $_GET['vbeln'] ?? '3000008';
$posnr = $_GET['posnr'] ?? '000010';
$cache = isset($_GET['cache']) && ($_GET['cache'] === '1' || $_GET['cache'] === 'true');

$result = $client->getCostSheet((string)$vbeln, (string)$posnr, $cache);
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
