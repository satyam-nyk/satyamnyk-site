<?php
require_once dirname(__DIR__) . '/dashboard-config.php';
$config = dashboard_config();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Reel Agent - Dashboard Access</title>
  <style>
    :root {
      --bg: #090d18;
      --bg2: #101829;
      --card: #141f35;
      --text: #f3f7ff;
      --muted: #9fb0cc;
      --accent: #2dd4bf;
      --accent2: #60a5fa;
      --danger: #f87171;
      --border: rgba(255,255,255,0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 0% 0%, rgba(96,165,250,0.18), transparent 45%),
        radial-gradient(900px 500px at 100% 100%, rgba(45,212,191,0.15), transparent 45%),
        linear-gradient(160deg, var(--bg), var(--bg2));
      display: grid;
      place-items: center;
      padding: 20px;
    }
    .panel {
      width: min(420px, 100%);
      background: rgba(20,31,53,0.88);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 28px;
      backdrop-filter: blur(8px);
      box-shadow: 0 28px 70px rgba(0,0,0,0.45);
    }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { margin: 0 0 18px; color: var(--muted); }
    label { display: block; margin: 14px 0 8px; font-size: 0.92rem; color: var(--muted); }
    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      color: var(--text);
      background: #0d1527;
      outline: none;
    }
    input:focus { border-color: var(--accent2); }
    button {
      width: 100%;
      margin-top: 18px;
      border: none;
      border-radius: 10px;
      padding: 12px;
      font-weight: 700;
      color: #05232b;
      background: linear-gradient(120deg, var(--accent), var(--accent2));
      cursor: pointer;
    }
    .msg { margin-top: 12px; min-height: 20px; font-size: 0.9rem; color: var(--danger); }
    .links { margin-top: 16px; text-align: center; }
    .links a { color: var(--accent2); text-decoration: none; }
  </style>
</head>
<body>
  <form class="panel" id="login-form">
    <h1>Dashboard Access (Demo)</h1>
    <p>Credentials are prefilled for showcase mode. Click to open dashboard.</p>

    <label for="username">Username</label>
    <input id="username" name="username" type="text" autocomplete="username" required value="<?php echo htmlspecialchars($config['username'], ENT_QUOTES, 'UTF-8'); ?>" />

    <label for="password">Password</label>
    <input id="password" name="password" type="text" autocomplete="off" required value="<?php echo htmlspecialchars($config['password'], ENT_QUOTES, 'UTF-8'); ?>" />

    <button type="submit">Open Dashboard</button>
    <div class="msg" id="msg"></div>
    <div class="links"><a href="microsite.html">Back to public microsite</a></div>
  </form>

  <script>
    const form = document.getElementById('login-form');
    const msg = document.getElementById('msg');
    const params = new URLSearchParams(window.location.search);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      window.location.href = 'dashboard.php';
    });

    if (params.get('autologin') === '1') {
      msg.textContent = 'Opening dashboard...';
      setTimeout(() => {
        window.location.href = 'dashboard.php';
      }, 450);
    }
  </script>
</body>
</html>
