<?php

require_once dirname(__DIR__) . '/dashboard-config.php';

$config = dashboard_config();
$phpVersion = PHP_VERSION;
$pdoSqlite = extension_loaded('pdo_sqlite');
$sqlite3Ext = extension_loaded('sqlite3');
$dbExists = is_file($config['database_path']);
$dbReadable = is_readable($config['database_path']);
$envExists = is_file(dirname(__DIR__) . '/.env');
$envReadable = is_readable(dirname(__DIR__) . '/.env');
$sessionWritable = is_writable(session_save_path() ?: sys_get_temp_dir());

$pdoError = null;
if ($pdoSqlite && $dbExists && $dbReadable) {
    try {
        $pdo = dashboard_pdo();
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $error) {
        $pdoError = $error->getMessage();
        $tables = [];
    }
} else {
    $tables = [];
}

function diag_status($ok)
{
    return $ok ? 'OK' : 'FAIL';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Diagnostics</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #0b1220; color: #e8eef7; }
    .wrap { max-width: 920px; margin: 0 auto; }
    h1 { margin-top: 0; }
    .card { background: #121b2d; border: 1px solid #25314b; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
    .row { display: grid; grid-template-columns: 260px 120px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid #1d2840; }
    .row:last-child { border-bottom: none; }
    .ok { color: #34d399; font-weight: 700; }
    .fail { color: #f87171; font-weight: 700; }
    code { background: #0a1424; padding: 2px 6px; border-radius: 6px; color: #c7d6ea; }
    ul { margin: 8px 0 0 18px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Dashboard Diagnostics</h1>
    <div class="card">
      <div class="row"><div>PHP Version</div><div class="<?php echo version_compare($phpVersion, '7.4.0', '>=') ? 'ok' : 'fail'; ?>"><?php echo version_compare($phpVersion, '7.4.0', '>=') ? 'OK' : 'FAIL'; ?></div><div><?php echo htmlspecialchars($phpVersion, ENT_QUOTES, 'UTF-8'); ?></div></div>
      <div class="row"><div>PDO SQLite Extension</div><div class="<?php echo $pdoSqlite ? 'ok' : 'fail'; ?>"><?php echo diag_status($pdoSqlite); ?></div><div>Required for reading <code>database.sqlite</code></div></div>
      <div class="row"><div>SQLite3 Extension</div><div class="<?php echo $sqlite3Ext ? 'ok' : 'fail'; ?>"><?php echo diag_status($sqlite3Ext); ?></div><div>Optional but commonly enabled</div></div>
      <div class="row"><div>.env Uploaded</div><div class="<?php echo $envExists ? 'ok' : 'fail'; ?>"><?php echo diag_status($envExists); ?></div><div><?php echo htmlspecialchars(dirname(__DIR__) . '/.env', ENT_QUOTES, 'UTF-8'); ?></div></div>
      <div class="row"><div>.env Readable</div><div class="<?php echo $envReadable ? 'ok' : 'fail'; ?>"><?php echo diag_status($envReadable); ?></div><div>Needed for username/password and secrets</div></div>
      <div class="row"><div>SQLite Database Uploaded</div><div class="<?php echo $dbExists ? 'ok' : 'fail'; ?>"><?php echo diag_status($dbExists); ?></div><div><?php echo htmlspecialchars($config['database_path'], ENT_QUOTES, 'UTF-8'); ?></div></div>
      <div class="row"><div>SQLite Database Readable</div><div class="<?php echo $dbReadable ? 'ok' : 'fail'; ?>"><?php echo diag_status($dbReadable); ?></div><div>Needed for analytics data</div></div>
      <div class="row"><div>PHP Session Path Writable</div><div class="<?php echo $sessionWritable ? 'ok' : 'fail'; ?>"><?php echo diag_status($sessionWritable); ?></div><div>Needed for login sessions</div></div>
    </div>

    <div class="card">
      <h2>Detected Tables</h2>
      <?php if ($pdoError): ?>
        <p class="fail">Database open error: <?php echo htmlspecialchars($pdoError, ENT_QUOTES, 'UTF-8'); ?></p>
      <?php elseif (!$tables): ?>
        <p class="fail">No tables detected.</p>
      <?php else: ?>
        <ul>
          <?php foreach ($tables as $table): ?>
            <li><code><?php echo htmlspecialchars($table, ENT_QUOTES, 'UTF-8'); ?></code></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>

    <div class="card">
      <h2>Files in <code><?php echo htmlspecialchars(dirname(__DIR__), ENT_QUOTES, 'UTF-8'); ?>/</code></h2>
      <?php
        $parentDir = dirname(__DIR__);
        $allFiles = @scandir($parentDir);
        if ($allFiles === false) {
            echo '<p class="fail">Cannot scan directory (permissions error)</p>';
        } else {
            echo '<ul>';
            foreach ($allFiles as $f) {
                if ($f === '.' || $f === '..') continue;
                $fp = $parentDir . '/' . $f;
                $size = is_file($fp) ? ' (' . number_format(filesize($fp)) . ' bytes)' : '/';
                $perm = substr(sprintf('%o', fileperms($fp)), -4);
                $highlight = ($f === '.env' || $f === 'database.sqlite') ? ' style="color:#fbbf24;font-weight:700"' : '';
                echo '<li' . $highlight . '><code>' . htmlspecialchars($f, ENT_QUOTES, 'UTF-8') . '</code>' . htmlspecialchars($size . ' [' . $perm . ']', ENT_QUOTES, 'UTF-8') . '</li>';
            }
            echo '</ul>';
        }
      ?>
    </div>

    <div class="card">
      <h2>Next URLs</h2>
      <ul>
        <li><a href="dashboard-login.php">dashboard-login.php</a></li>
        <li><a href="dashboard.php">dashboard.php</a></li>
        <li><a href="dashboard-public-stats.php">dashboard-public-stats.php</a></li>
      </ul>
    </div>
  </div>
</body>
</html>
