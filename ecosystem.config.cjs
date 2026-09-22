// pm2 process file: `npx pm2 start ecosystem.config.cjs` runs everything the live weekend needs.
module.exports = {
  apps: [
    {
      // Keeps the Mac from idle- or system-sleeping while the weekend runs (macOS built-in).
      name: "awake",
      script: "caffeinate",
      args: "-ims",
      interpreter: "none",
      autorestart: true,
    },
    {
      name: "relayer",
      cwd: "apps/relayer",
      script: "npm",
      args: "run start",
      autorestart: true,
      restart_delay: 5000,
      out_file: "../../logs/relayer.log",
      error_file: "../../logs/relayer.log",
    },
    {
      name: "agent",
      cwd: "apps/agent",
      script: "npm",
      args: "run start",
      autorestart: true,
      restart_delay: 10000,
      out_file: "../../logs/agent.log",
      error_file: "../../logs/agent.log",
    },
    {
      name: "web",
      cwd: "apps/web",
      script: "npm",
      args: "run preview -- --port 4173 --strictPort",
      autorestart: true,
      out_file: "../../logs/web.log",
      error_file: "../../logs/web.log",
    },
  ],
};
