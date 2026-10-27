<?php
declare(strict_types=1);

require_once __DIR__ . '/app/PortalAuth.php';
require_once __DIR__ . '/app/AuditLog.php';

use App\PortalAuth;
use App\AuditLog;

$user = PortalAuth::currentUser();
if (!$user['is_admin']) {
    header('Location: index.php', true, 302);
    exit;
}

$audit = new AuditLog();
$vbeln = trim((string)($_GET['vbeln'] ?? ''));
$limit = max(20, min(200, (int)($_GET['limit'] ?? 100)));
$entries = $audit->recent($limit, $vbeln !== '' ? $vbeln : null);

function h(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function fmtWhen(?string $ts): string
{
    if (!$ts) {
        return '—';
    }
    $t = strtotime($ts);
    return $t ? date('d M Y H:i:s', $t) : $ts;
}

function statusLabel(array $entry): string
{
    $approve = strtoupper((string)($entry['approve'] ?? ''));
    if ($approve === 'X') {
        return 'APPROVED';
    }
    $action = strtolower((string)($entry['action'] ?? 'save'));
    if ($action === 'approve_save') {
        return 'APPROVE SAVE';
    }
    return 'SAVE';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Log · Sales Costing Sheet</title>
  <link rel="stylesheet" href="public/css/sap_theme.css?v=20">
  <link rel="stylesheet" href="public/css/evolv_landing.css?v=4">
  <link rel="stylesheet" href="public/css/audit_page.css?v=2">
</head>
<body class="sap-body audit-page-body">
  <div class="sap-window audit-page-window">
    <header class="studio-navbar">
      <div class="studio-nav-left">
        <a href="index.php" class="studio-logo-link" title="Back to Costing Sheet">
          <img src="public/logo.png" alt="EVOLV" class="studio-logo-img" onerror="this.style.display='none';">
          <span class="evolv-logo-text">evolv</span>
        </a>
        <div class="studio-nav-divider"></div>
        <a href="index.php" class="studio-home-btn" title="Costing Sheet">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </a>
        <span class="nav-title-wrap">
          <span class="studio-page-title">Audit Log</span>
          <span class="sap-screen-title approved">LIVE ADMIN</span>
        </span>
      </div>
      <div class="studio-nav-right">
        <a class="studio-btn studio-btn-outline" href="index.php">Back to Sheet</a>
        <div class="evolv-user-pill" style="pointer-events:none;">
          <div class="evolv-avatar-wrapper">
            <div class="evolv-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <span class="evolv-status-dot"></span>
          </div>
          <div class="evolv-user-info">
            <span class="evolv-user-name"><?= h($user['display_name']) ?></span>
            <span class="evolv-user-role"><?= h(strtoupper($user['role'])) ?></span>
          </div>
        </div>
      </div>
    </header>

    <main class="audit-page-main">
      <section class="audit-page-hero">
        <div>
          <h1>Sales Costing Audit Log</h1>
          <p>Save and approve activity for live SAP costing sheets. Visible to portal admin logins only.</p>
        </div>
        <form class="audit-filter" method="get" action="audit.php">
          <label>
            <span>SO / Quotation</span>
            <input type="text" name="vbeln" value="<?= h($vbeln) ?>" placeholder="All quotations">
          </label>
          <label>
            <span>Limit</span>
            <select name="limit">
              <?php foreach ([50, 100, 150, 200] as $opt): ?>
                <option value="<?= $opt ?>" <?= $limit === $opt ? 'selected' : '' ?>><?= $opt ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <button type="submit" class="studio-btn studio-btn-save">Filter</button>
          <?php if ($vbeln !== ''): ?>
            <a class="studio-btn studio-btn-outline" href="audit.php">Clear</a>
          <?php endif; ?>
        </form>
      </section>

      <section class="audit-page-card">
        <div class="audit-page-meta">
          <strong><?= count($entries) ?></strong> entries
          <span>· signed in as <?= h($user['username']) ?></span>
        </div>
        <div class="audit-table-wrap audit-page-table-wrap">
          <table class="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Method</th>
                <th>URL</th>
                <th>HTTP</th>
                <th>SO / Item</th>
                <th>Lines</th>
                <th>Result</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              <?php if ($entries === []): ?>
                <tr><td colspan="9" class="audit-empty">
                  No audit activity yet.<br>
                  <small>Entries appear only after you click <b>Save</b> or <b>Approve</b> on a costing sheet. Opening / viewing a sheet does not create a log row.</small>
                </td></tr>
              <?php else: ?>
                <?php foreach ($entries as $i => $entry): ?>
                  <?php
                    $ok = !empty($entry['success']);
                    $lines = $entry['lines']['total'] ?? 0;
                    $so = trim(($entry['vbeln'] ?? '') . ' / ' . ($entry['posnr'] ?? ''), ' /');
                    $method = strtoupper((string)($entry['method'] ?? 'POST'));
                    $url = (string)($entry['url'] ?? '');
                    $http = (int)($entry['http_code'] ?? 0);
                    $payload = $entry['payload'] ?? null;
                    $payloadJson = is_array($payload)
                      ? json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                      : '';
                    $detailId = 'audit-payload-' . $i;
                    $csrfMethod = strtoupper((string)($entry['csrf_method'] ?? ''));
                    $csrfUrl = (string)($entry['csrf_url'] ?? '');
                  ?>
                  <tr>
                    <td><?= h(fmtWhen($entry['ts'] ?? null)) ?></td>
                    <td><?= h((string)($entry['user'] ?? '—')) ?></td>
                    <td><span class="audit-method audit-method-<?= h(strtolower($method)) ?>"><?= h($method) ?></span></td>
                    <td class="audit-mono audit-url" title="<?= h($url) ?>"><?= h($url !== '' ? $url : '—') ?></td>
                    <td class="audit-mono"><?= $http > 0 ? $http : '—' ?></td>
                    <td class="audit-mono"><?= h($so !== '' ? $so : '—') ?></td>
                    <td class="audit-mono"><?= (int)$lines ?></td>
                    <td>
                      <span class="audit-result <?= $ok ? 'ok' : 'fail' ?>"><?= $ok ? 'OK' : 'FAIL' ?></span>
                      <small class="audit-msg"><?= h((string)($entry['message'] ?? $entry['source'] ?? '')) ?></small>
                    </td>
                    <td>
                      <?php if ($payloadJson !== ''): ?>
                        <button type="button" class="audit-payload-btn" onclick="document.getElementById('<?= h($detailId) ?>').hidden = !document.getElementById('<?= h($detailId) ?>').hidden">
                          View
                        </button>
                      <?php else: ?>
                        <span class="audit-muted">—</span>
                      <?php endif; ?>
                    </td>
                  </tr>
                  <?php if ($payloadJson !== ''): ?>
                    <tr id="<?= h($detailId) ?>" class="audit-payload-row" hidden>
                      <td colspan="9">
                        <div class="audit-payload-box">
                          <div class="audit-payload-meta">
                            <div><strong>Method:</strong> <?= h($method) ?></div>
                            <div><strong>URL:</strong> <code><?= h($url !== '' ? $url : '—') ?></code></div>
                            <div><strong>HTTP:</strong> <?= $http > 0 ? $http : '—' ?></div>
                            <?php if ($csrfUrl !== ''): ?>
                              <div><strong>CSRF:</strong> <?= h($csrfMethod !== '' ? $csrfMethod : 'GET') ?> <code><?= h($csrfUrl) ?></code></div>
                            <?php endif; ?>
                          </div>
                          <pre class="audit-payload-json"><?= h($payloadJson) ?></pre>
                        </div>
                      </td>
                    </tr>
                  <?php endif; ?>
                <?php endforeach; ?>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</body>
</html>
