<?php
declare(strict_types=1);

namespace App;

/**
 * Lightweight file-based audit trail for ZCOST save / approve actions.
 */
class AuditLog
{
    private string $logFile;
    private int $maxEntries;

    public function __construct(?string $logFile = null, int $maxEntries = 500)
    {
        $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'audit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $this->logFile = $logFile ?: ($dir . DIRECTORY_SEPARATOR . 'zcost_saves.jsonl');
        $this->maxEntries = max(50, $maxEntries);
    }

    /**
     * Append one audit event.
     *
     * @param array<string, mixed> $payload Cost sheet header snapshot
     * @param array<string, mixed> $saveResult Result from SapClient::saveCostSheet
     * @return array<string, mixed> Written audit entry
     */
    public function logSave(array $payload, array $saveResult, string $action = 'save'): array
    {
        $fab = $this->countNav($payload, 'to_Fabric');
        $trim = $this->countNav($payload, 'to_Trim');
        $pack = $this->countNav($payload, 'to_Packing');
        $special = $this->countNav($payload, 'to_Special');

        $entry = [
            'id' => bin2hex(random_bytes(8)),
            'ts' => date('c'),
            'action' => $action,
            'user' => $this->resolveUser(),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'vbeln' => (string)($payload['Vbeln'] ?? ''),
            'posnr' => (string)($payload['Posnr'] ?? ''),
            'approve' => (string)($payload['Approve'] ?? ''),
            'cnv' => (string)($payload['Cnv'] ?? ''),
            'cnvf' => (string)($payload['Cnvf'] ?? ''),
            'sellprice' => (string)($payload['Sellprice'] ?? ''),
            'quota' => (string)($payload['Quota'] ?? ''),
            'lines' => [
                'fabric' => $fab,
                'trim' => $trim,
                'packing' => $pack,
                'special' => $special,
                'total' => $fab + $trim + $pack + $special,
            ],
            'success' => !empty($saveResult['success']),
            'source' => (string)($saveResult['source'] ?? ''),
            'http_code' => (int)($saveResult['http_code'] ?? $saveResult['sap_http_code'] ?? 0),
            'message' => (string)($saveResult['message'] ?? $saveResult['error'] ?? ''),
            // SAP request details for admin debugging
            'method' => strtoupper((string)($saveResult['method'] ?? 'POST')),
            'url' => (string)($saveResult['url'] ?? ''),
            'payload' => $this->compactPayload($saveResult['payload'] ?? $payload),
            'csrf_method' => strtoupper((string)($saveResult['csrf_method'] ?? 'GET')),
            'csrf_url' => (string)($saveResult['csrf_url'] ?? ''),
        ];

        $line = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($line === false) {
            $entry['write_ok'] = false;
            $entry['write_error'] = 'Could not encode audit entry.';
            return $entry;
        }

        $dir = dirname($this->logFile);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            $entry['write_ok'] = false;
            $entry['write_error'] = 'Audit folder is not writable: ' . $dir;
            return $entry;
        }

        $written = @file_put_contents($this->logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
        if ($written === false) {
            // Fallback to system temp so audit is never silently lost
            $fallback = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'zcost_saves.jsonl';
            $written = @file_put_contents($fallback, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
            if ($written !== false) {
                $this->logFile = $fallback;
                $entry['write_ok'] = true;
                $entry['write_path'] = $fallback;
            } else {
                $entry['write_ok'] = false;
                $entry['write_error'] = 'Failed to write audit log file.';
                return $entry;
            }
        } else {
            $entry['write_ok'] = true;
            $entry['write_path'] = $this->logFile;
        }

        $this->trimFile();

        return $entry;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recent(int $limit = 40, ?string $vbeln = null): array
    {
        $files = [$this->logFile];
        $fallback = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'zcost_saves.jsonl';
        if ($fallback !== $this->logFile) {
            $files[] = $fallback;
        }

        $entries = [];
        foreach ($files as $file) {
            if (!is_file($file)) {
                continue;
            }
            $raw = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (!is_array($raw) || $raw === []) {
                continue;
            }
            foreach (array_reverse($raw) as $line) {
                $decoded = json_decode($line, true);
                if (!is_array($decoded)) {
                    continue;
                }
                if ($vbeln !== null && $vbeln !== '' && (string)($decoded['vbeln'] ?? '') !== $vbeln) {
                    continue;
                }
                $entries[] = $decoded;
            }
        }

        usort($entries, static function (array $a, array $b): int {
            return strcmp((string)($b['ts'] ?? ''), (string)($a['ts'] ?? ''));
        });

        // De-dupe by id if same entry exists in primary + fallback
        $seen = [];
        $unique = [];
        foreach ($entries as $entry) {
            $id = (string)($entry['id'] ?? '');
            if ($id !== '' && isset($seen[$id])) {
                continue;
            }
            if ($id !== '') {
                $seen[$id] = true;
            }
            $unique[] = $entry;
            if (count($unique) >= $limit) {
                break;
            }
        }

        return $unique;
    }

    private function countNav(array $payload, string $key): int
    {
        if (!isset($payload[$key]['results']) || !is_array($payload[$key]['results'])) {
            return 0;
        }
        return count($payload[$key]['results']);
    }

    /**
     * Keep payload audit-friendly (array). Cap huge nav arrays for log size.
     *
     * @param mixed $payload
     * @return array<string, mixed>|null
     */
    private function compactPayload($payload): ?array
    {
        if (!is_array($payload)) {
            return null;
        }
        if (isset($payload['d']) && is_array($payload['d'])) {
            $payload = $payload['d'];
        }
        $out = $payload;
        foreach (['to_Fabric', 'to_Trim', 'to_Packing', 'to_Special'] as $nav) {
            if (!isset($out[$nav]['results']) || !is_array($out[$nav]['results'])) {
                continue;
            }
            // Keep full lines — needed for debugging; trimFile already caps entry count
            $out[$nav] = ['results' => array_values($out[$nav]['results'])];
        }
        return $out;
    }

    private function resolveUser(): string
    {
        if (class_exists(__NAMESPACE__ . '\\PortalAuth')) {
            $user = PortalAuth::currentUser();
            if (!empty($user['username']) && $user['username'] !== 'Guest') {
                return (string)$user['username'];
            }
        }
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        $candidates = [
            $_SESSION['username'] ?? null,
            $_SESSION['user'] ?? null,
            $_SESSION['user_name'] ?? null,
            $_SERVER['HTTP_X_USER'] ?? null,
        ];
        foreach ($candidates as $u) {
            if (is_string($u) && trim($u) !== '') {
                return trim($u);
            }
        }
        return 'Admin';
    }

    private function trimFile(): void
    {
        if (!is_file($this->logFile)) {
            return;
        }
        $raw = @file($this->logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($raw) || count($raw) <= $this->maxEntries) {
            return;
        }
        $keep = array_slice($raw, -$this->maxEntries);
        @file_put_contents($this->logFile, implode(PHP_EOL, $keep) . PHP_EOL, LOCK_EX);
    }
}
