<?php

function dashboard_load_env(string $path): array
{
    $env = [];
    if (!is_file($path)) {
        return $env;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return $env;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) {
            continue;
        }

        [$key, $value] = explode('=', $trimmed, 2);
        $env[trim($key)] = trim($value);
    }

    return $env;
}

function dashboard_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $env = dashboard_load_env(__DIR__ . '/.env');
    $config = [
        'username' => $env['DASHBOARD_USERNAME'] ?? 'admin',
        'password' => $env['DASHBOARD_PASSWORD'] ?? 'change-me',
        'auth_secret' => $env['DASHBOARD_AUTH_SECRET'] ?? ($env['WEBHOOK_SECRET'] ?? 'change-this-secret'),
        'database_path' => $env['DATABASE_PATH'] ?? (__DIR__ . '/database.sqlite'),
    ];

    if (substr($config['database_path'], 0, 1) !== '/') {
        $config['database_path'] = __DIR__ . '/' . ltrim($config['database_path'], './');
    }

    return $config;
}

function dashboard_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 604800,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    ]);
    session_start();
}

function dashboard_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = dashboard_config();
    if (!is_file($config['database_path'])) {
        throw new RuntimeException('SQLite database not found. Upload ai-reel-agent/database.sqlite to the server.');
    }

    if (!extension_loaded('pdo_sqlite')) {
        throw new RuntimeException('PDO SQLite is not available on this hosting plan.');
    }

    $pdo = new PDO('sqlite:' . $config['database_path']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function dashboard_is_authenticated(): bool
{
    dashboard_start_session();
    return !empty($_SESSION['dashboard_user']);
}

function dashboard_require_auth_page(): void
{
    if (!dashboard_is_authenticated()) {
        header('Location: dashboard-login.php');
        exit;
    }
}

function dashboard_require_auth_api(): void
{
    if (!dashboard_is_authenticated()) {
        dashboard_json(['success' => false, 'error' => 'Unauthorized'], 401);
    }
}

function dashboard_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function dashboard_request_json(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
