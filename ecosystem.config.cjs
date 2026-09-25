// pm2 process file: `npx pm2 start ecosystem.config.cjs` runs everything the live weekend needs, plus the
// weekday demo. Runs on one machine only: the relayer, agent and demo sign with the deployer key.
const onMac = process.platform === "darwin";

module.exports = {
  apps: [
    ...(onMac
      ? [
          {
            // Keeps the Mac from idle- or system-sleeping while the weekend runs (macOS built-in).
            name: "awake",
            script: "caffeinate",
            args: "-ims",
            interpreter: "none",
            autorestart: true,
          },
        ]
      : []),
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
      // Weekday demo: a private anvil fork held on Saturday, served to the web app at /demo through /demo-api.
      name: "demo",
      cwd: "apps/demo",
      script: "npm",
      args: "run start",
      autorestart: true,
      restart_delay: 10000,
      kill_timeout: 5000,
      out_file: "../../logs/demo.log",
      error_file: "../../logs/demo.log",
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
