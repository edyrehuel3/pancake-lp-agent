module.exports = {
  apps: [{
    name: 'pancake-lp',
    script: './index.js',
    env: { NODE_ENV: 'production' },
    max_restarts: 10,
    restart_delay: 5000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
