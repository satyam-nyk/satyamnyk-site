module.exports = {
  apps: [
    {
      name: 'ai-reel-agent',
      cwd: __dirname,
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: '20s',
      kill_timeout: 8000,
      max_memory_restart: '800M',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
