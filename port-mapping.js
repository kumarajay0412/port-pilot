// Port to service mapping for better user experience

const PORT_DESCRIPTIONS = {
  // Web servers
  80: 'HTTP Web Server',
  443: 'HTTPS Web Server',
  8080: 'HTTP Web Server (Alternative)',
  8443: 'HTTPS Web Server (Alternative)',

  // Development servers
  3000: 'Web Development Server',
  3001: 'Web Development Server (Secondary)',
  4000: 'Web Development Server (Alternative)',
  5000: 'Web Development Server (Alternative)',
  8000: 'Web Development Server (Alternative)',
  9000: 'Web Development Server (Alternative)',

  // Databases
  3306: 'MySQL Database',
  5432: 'PostgreSQL Database',
  27017: 'MongoDB Database',
  6379: 'Redis Cache',
  5984: 'CouchDB Database',

  // API and backend services
  5000: 'Python Flask/FastAPI Server',
  8000: 'Django Development Server',
  4000: 'Express.js Server',
  5001: 'Backend API Server',

  // System services
  22: 'SSH Remote Access',
  23: 'Telnet (Insecure)',
  25: 'SMTP Email Server',
  53: 'DNS Server',
  110: 'POP3 Email Server',
  143: 'IMAP Email Server',
  993: 'IMAPS Secure Email',
  995: 'POP3S Secure Email',

  // Development tools
  35729: 'Live Reload Server',
  24678: 'Webpack Dev Server',

  // Version control
  9418: 'Git Protocol',

  // Monitoring and observability
  9090: 'Prometheus Monitoring',
  3001: 'Grafana Dashboard',
  5601: 'Kibana (Elasticsearch)',
  9200: 'Elasticsearch',

  // Message queues
  5672: 'RabbitMQ',
  1883: 'MQTT Broker',
  61616: 'Apache ActiveMQ',

  // File sharing
  21: 'FTP Server',
  69: 'TFTP Server',
  115: 'SFTP Server',
  990: 'FTPS Secure FTP',

  // Remote desktop
  3389: 'RDP (Windows Remote Desktop)',
  5900: 'VNC Remote Desktop',

  // Gaming
  25565: 'Minecraft Server',

  // Common local development
  7000: 'AirPlay Receiver',
  7001: 'Local Development Server (Secondary)',
  8001: 'Local Development Server (Alternative)',
  9001: 'Local Development Server (Alternative)',
};

// Helper function to get user-friendly port description
function getPortDescription(port, originalName) {
  const description = PORT_DESCRIPTIONS[port];
  return description ? description : originalName;
}

module.exports = {
  PORT_DESCRIPTIONS,
  getPortDescription
};
