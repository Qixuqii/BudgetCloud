module.exports = {
  apps: [
    {
      name: 'api',
      cwd: '/home/ubuntu/apps/Budget/api',
      script: 'npm',
      args: 'run dev',               // 对应 api/package.json 里的 "dev": "nodemon index.js"
      env: { PORT: 8800, NODE_ENV: 'production' }
    },
    {
      name: 'client',
      cwd: '/home/ubuntu/apps/Budget/client',
      script: 'npm',
      // 让 Vite 直接监听 0.0.0.0:80（你之前已经给 node 设置了低端口能力）
      args: 'run dev -- --host 0.0.0.0 --port 80'
    }
  ]
}

