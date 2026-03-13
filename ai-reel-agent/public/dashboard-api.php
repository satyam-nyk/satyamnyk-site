<?php

require_once dirname(__DIR__) . '/dashboard-config.php';

dashboard_start_session();

function api_limit_status(PDO $pdo, string $service, int $limit): array
{
    $today = date('Y-m-d');
    $stmt = $pdo->prepare('SELECT calls_used FROM api_usage WHERE service = ? AND date = ?');
    $stmt->execute([$service, $today]);
    $used = (int) ($stmt->fetchColumn() ?: 0);
    $remaining = max(0, $limit - $used);
    return [
        'service' => $service,
        'used' => $used,
        'remaining' => $remaining,
        'available' => $remaining > 0,
        'limit' => $limit,
        'status' => $remaining > 0 ? 'healthy' : 'warning',
    ];
}

function api_monthly_status(PDO $pdo, string $service, int $limit): array
{
    $monthStart = date('Y-m-01');
    $stmt = $pdo->prepare('SELECT SUM(calls_used) FROM api_usage WHERE service = ? AND date >= ?');
    $stmt->execute([$service, $monthStart]);
    $used = (int) ($stmt->fetchColumn() ?: 0);
    $remaining = max(0, $limit - $used);
    return [
        'service' => $service,
        'total' => $limit,
        'used' => $used,
        'remaining' => $remaining,
        'status' => $remaining > 5 ? 'healthy' : 'warning',
    ];
}

function fetch_one(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: null;
}

function fetch_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    return $rows ?: [];
}

function dashboard_today_payload(PDO $pdo): array
{
    $today = date('Y-m-d');
    $post = fetch_one($pdo, 'SELECT * FROM daily_posts WHERE date = ?', [$today]);
    return [
        'date' => $today,
        'post' => $post,
        'status' => $post['status'] ?? 'not_started',
    ];
}

function dashboard_stats(PDO $pdo): array
{
    $row = fetch_one($pdo, "
        SELECT
          COUNT(*) as total_posts,
          SUM(views) as total_views,
          SUM(likes) as total_likes,
          SUM(comments) as total_comments,
          SUM(shares) as total_shares,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG((likes + comments + shares) * 100.0 / NULLIF(views, 0)), 2) as avg_engagement_rate
        FROM daily_posts
        WHERE status = 'posted'
    ");

    return [
        'totalPosts' => (int) ($row['total_posts'] ?? 0),
        'totalViews' => (int) ($row['total_views'] ?? 0),
        'totalLikes' => (int) ($row['total_likes'] ?? 0),
        'totalComments' => (int) ($row['total_comments'] ?? 0),
        'totalShares' => (int) ($row['total_shares'] ?? 0),
        'avgViews' => (float) ($row['avg_views'] ?? 0),
        'avgEngagementRate' => (float) ($row['avg_engagement_rate'] ?? 0),
    ];
}

function dashboard_insights(PDO $pdo, int $days = 30): array
{
    $range = '-' . $days . ' days';
    $kpi = fetch_one($pdo, "
        SELECT
          COUNT(*) as total_posts,
          SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(views) as total_views,
          SUM(likes) as total_likes,
          SUM(comments) as total_comments,
          SUM(shares) as total_shares,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_rate
        FROM daily_posts
        WHERE date >= date('now', ?)
    ", [$range]) ?: [];

    $topTopics = fetch_all($pdo, "
        SELECT
          topic,
          COUNT(*) as posts,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_rate
        FROM daily_posts
        WHERE date >= date('now', ?) AND topic IS NOT NULL AND topic != ''
        GROUP BY topic
        ORDER BY posts DESC, avg_views DESC
        LIMIT 10
    ", [$range]);

    $methodSplit = fetch_all($pdo, "
        SELECT COALESCE(generation_method, 'unknown') as method, COUNT(*) as count
        FROM daily_posts
        WHERE date >= date('now', ?)
        GROUP BY COALESCE(generation_method, 'unknown')
        ORDER BY count DESC
    ", [$range]);

    return [
        'kpi' => $kpi,
        'topTopics' => $topTopics,
        'methodSplit' => $methodSplit,
    ];
}

function dashboard_recommendations(PDO $pdo, int $days = 90): array
{
    $range = '-' . $days . ' days';
    $bestHour = fetch_one($pdo, "
        SELECT
          strftime('%H', posted_at) as hour,
          COUNT(*) as posts,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement
        FROM daily_posts
        WHERE status = 'posted' AND posted_at IS NOT NULL AND date >= date('now', ?)
        GROUP BY strftime('%H', posted_at)
        ORDER BY COALESCE(avg_engagement, 0) DESC, COALESCE(avg_views, 0) DESC, posts DESC
        LIMIT 1
    ", [$range]);

    $bestDay = fetch_one($pdo, "
        SELECT
          strftime('%w', posted_at) as day,
          COUNT(*) as posts,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement
        FROM daily_posts
        WHERE status = 'posted' AND posted_at IS NOT NULL AND date >= date('now', ?)
        GROUP BY strftime('%w', posted_at)
        ORDER BY COALESCE(avg_engagement, 0) DESC, COALESCE(avg_views, 0) DESC, posts DESC
        LIMIT 1
    ", [$range]);

    $momentumTopics = fetch_all($pdo, "
        SELECT
          topic,
          COUNT(CASE WHEN date >= date('now', '-14 days') THEN 1 END) as recent_posts,
          ROUND(AVG(CASE WHEN date >= date('now', '-14 days') THEN views END), 2) as recent_avg_views,
          ROUND(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 2) as previous_avg_views,
          ROUND(
            ((COALESCE(AVG(CASE WHEN date >= date('now', '-14 days') THEN views END), 0) -
            COALESCE(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 0))
            * 100.0) /
            CASE
              WHEN COALESCE(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 0) <= 0 THEN 1
              ELSE AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END)
            END,
            2
          ) as momentum_score
        FROM daily_posts
        WHERE status = 'posted' AND topic IS NOT NULL AND topic != ''
        GROUP BY topic
        HAVING recent_posts > 0
        ORDER BY momentum_score DESC, recent_avg_views DESC
        LIMIT 5
    ");

    $cadence = fetch_one($pdo, "
        SELECT
          COUNT(*) as posts_last_7,
          ROUND(AVG(views), 2) as avg_views_last_7,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_last_7
        FROM daily_posts
        WHERE status = 'posted' AND date >= date('now', '-7 days')
    ") ?: [];

    return [
        'bestHour' => $bestHour,
        'bestDay' => $bestDay,
        'momentumTopics' => $momentumTopics,
        'cadence' => $cadence,
    ];
}

function dashboard_analytics(PDO $pdo, int $days = 30): array
{
    $rows = fetch_all($pdo, "
        SELECT * FROM analytics
        WHERE date >= date('now', ?)
        ORDER BY date DESC
    ", ['-' . $days . ' days']);

    return array_map(static function (array $row): array {
        return [
            'date' => $row['date'],
            'totalPosts' => (int) ($row['total_posts'] ?? 0),
            'totalViews' => (int) ($row['total_views'] ?? 0),
            'totalLikes' => (int) ($row['total_likes'] ?? 0),
            'totalComments' => (int) ($row['total_comments'] ?? 0),
            'totalShares' => (int) ($row['total_shares'] ?? 0),
            'avgViewsPerPost' => (float) ($row['average_views_per_post'] ?? 0),
            'avgEngagementRate' => (float) ($row['average_engagement_rate'] ?? 0),
        ];
    }, $rows);
}

function dashboard_post_history(PDO $pdo, int $limit, int $offset, string $status): array
{
    $where = '';
    $params = [];
    if ($status !== '' && $status !== 'all') {
        $where = 'WHERE status = ?';
        $params[] = $status;
    }

    $sql = "
        SELECT
          id,
          date,
          topic,
          script,
          video_id,
          instagram_post_id,
          views,
          likes,
          comments,
          shares,
          status,
          generation_method,
          posted_at,
          created_at,
          updated_at,
          CASE
            WHEN views > 0 THEN ROUND(((likes + comments + shares) * 100.0) / views, 2)
            ELSE 0
          END as engagement_rate
        FROM daily_posts
        {$where}
        ORDER BY date DESC
        LIMIT ? OFFSET ?
    ";

    $params[] = $limit;
    $params[] = $offset;
    return fetch_all($pdo, $sql, $params);
}

function dashboard_post_count(PDO $pdo, string $status): int
{
    if ($status !== '' && $status !== 'all') {
        $row = fetch_one($pdo, 'SELECT COUNT(*) as total FROM daily_posts WHERE status = ?', [$status]);
    } else {
        $row = fetch_one($pdo, 'SELECT COUNT(*) as total FROM daily_posts');
    }
    return (int) ($row['total'] ?? 0);
}

function dashboard_post_detail(PDO $pdo, int $id): ?array
{
    return fetch_one($pdo, "
        SELECT
          id,
          date,
          topic,
          script,
          video_id,
          instagram_post_id,
          views,
          likes,
          comments,
          shares,
          status,
          generation_method,
          posted_at,
          created_at,
          updated_at,
          CASE
            WHEN views > 0 THEN ROUND(((likes + comments + shares) * 100.0) / views, 2)
            ELSE 0
          END as engagement_rate
        FROM daily_posts
        WHERE id = ?
    ", [$id]);
}

try {
    $action = $_GET['action'] ?? '';
    $config = dashboard_config();

    if ($action === 'auth_login') {
        $body = dashboard_request_json();
        $username = trim((string) ($body['username'] ?? ''));
        $_SESSION['dashboard_user'] = $username !== '' ? $username : $config['username'];
        dashboard_json(['success' => true, 'demo' => true]);
    }

    if ($action === 'auth_logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        dashboard_json(['success' => true]);
    }

    if ($action === 'auth_session') {
        $username = $_SESSION['dashboard_user'] ?? $config['username'];
        dashboard_json(['success' => true, 'demo' => true, 'user' => ['username' => $username]]);
    }

    if ($action === 'public_stats') {
        $pdo = dashboard_pdo();
        $stats = dashboard_stats($pdo);
        $insights = dashboard_insights($pdo, 30);
        dashboard_json([
            'success' => true,
            'data' => [
                'totalPosts' => $stats['totalPosts'],
                'totalViews' => $stats['totalViews'],
                'avgEngagementRate' => $stats['avgEngagementRate'],
                'topMethod' => $insights['methodSplit'][0]['method'] ?? null,
            ],
        ]);
    }

    $pdo = dashboard_pdo();

    if ($action === 'dashboard_data') {
        $queuedScripts = fetch_one($pdo, "SELECT COUNT(*) as total FROM script_queue WHERE status = 'queued'") ?: [];
        $postedScripts = fetch_one($pdo, "SELECT COUNT(*) as total FROM script_queue WHERE status = 'posted'") ?: [];
        $cachedVideos = fetch_one($pdo, 'SELECT COUNT(*) as total FROM video_cache') ?: [];
        $reusedVideos = fetch_one($pdo, 'SELECT SUM(reuse_count) as total FROM video_cache') ?: [];
        $avgReuse = fetch_one($pdo, 'SELECT ROUND(AVG(reuse_count), 1) as avg_value FROM video_cache') ?: [];
        $methodCount = fetch_one($pdo, 'SELECT COUNT(DISTINCT generation_method) as total FROM video_cache') ?: [];

        $payload = [
            'success' => true,
            'timestamp' => gmdate('c'),
            'today' => dashboard_today_payload($pdo),
            'stats' => dashboard_stats($pdo),
            'apiUsage' => [
                'gemini' => api_limit_status($pdo, 'GEMINI', 50),
                'heygen' => api_monthly_status($pdo, 'HEYGEN', 10),
                'instagram' => api_limit_status($pdo, 'INSTAGRAM', 200),
            ],
            'queue' => [
                'total' => 0,
                'pending' => (int) ($queuedScripts['total'] ?? 0),
                'posted' => (int) ($postedScripts['total'] ?? 0),
            ],
            'cache' => [
                'totalCached' => (int) ($cachedVideos['total'] ?? 0),
                'totalReuses' => (int) ($reusedVideos['total'] ?? 0),
                'avgReuses' => (float) ($avgReuse['avg_value'] ?? 0),
                'methodsUsed' => (int) ($methodCount['total'] ?? 0),
            ],
            'trendingTopics' => fetch_all($pdo, "
                SELECT topic, COUNT(*) as posts, ROUND(AVG(views), 2) as avg_views,
                       ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_rate
                FROM daily_posts
                WHERE date >= date('now', '-30 days') AND topic IS NOT NULL AND topic != ''
                GROUP BY topic
                ORDER BY posts DESC, avg_views DESC
                LIMIT 10
            "),
            'analytics' => dashboard_analytics($pdo, 30),
            'insights' => dashboard_insights($pdo, 30),
            'recommendations' => dashboard_recommendations($pdo, 90),
        ];

        dashboard_json($payload);
    }

    if ($action === 'post_history') {
        $limit = max(1, min(100, (int) ($_GET['limit'] ?? 20)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        $status = trim((string) ($_GET['status'] ?? 'all'));

        dashboard_json([
            'success' => true,
            'data' => dashboard_post_history($pdo, $limit, $offset, $status),
            'pagination' => [
                'total' => dashboard_post_count($pdo, $status),
                'limit' => $limit,
                'offset' => $offset,
            ],
        ]);
    }

    if ($action === 'post_detail') {
        $id = (int) ($_GET['id'] ?? 0);
        $post = dashboard_post_detail($pdo, $id);
        if (!$post) {
            dashboard_json(['success' => false, 'error' => 'Post not found'], 404);
        }
        dashboard_json(['success' => true, 'data' => $post]);
    }

    if ($action === 'manual_post') {
        dashboard_json([
            'success' => false,
            'error' => 'Manual posting is unavailable on Hostinger shared hosting. Keep posting automation on your local or VPS Node backend.',
        ], 501);
    }

    dashboard_json(['success' => false, 'error' => 'Unknown action'], 404);
} catch (Throwable $error) {
    dashboard_json(['success' => false, 'error' => $error->getMessage()], 500);
}
