const morgan = require('morgan');
const DatabaseQueries = require('../database/queries');

// Custom Morgan token for request ID
morgan.token('id', (req) => req.id || '-');

// Custom Morgan token for response time in milliseconds
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) return '';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Custom format
const format = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms';

// Morgan middleware
const morganMiddleware = morgan(format, {
  stream: {
    write: (message) => {
      console.log(message.trim());
    }
  }
});

// Request logger middleware
const requestLogger = (req, res, next) => {
  req._startAt = process.hrtime();
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  next();
};

// Response logger middleware
const responseLogger = (req, res, next) => {
  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks = [];

  res.write = function(chunk) {
    chunks.push(chunk);
    return oldWrite.apply(res, arguments);
  };

  res.end = function(chunk) {
    if (chunk) chunks.push(chunk);
    
    const body = Buffer.concat(chunks).toString('utf8');
    const responseTime = req._startAt ? 
      (process.hrtime(req._startAt)[0] * 1e3 + process.hrtime(req._startAt)[1] * 1e-6).toFixed(2) : 0;
    
    // Log to database if it's an API request and not a health check
    if (req.path.startsWith('/api') && !req.path.includes('health')) {
      DatabaseQueries.addJournalEntry({
        type: 'SYSTEM',
        category: 'PERFORMANCE',
        title: 'API Request',
        message: `${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`,
        data: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          query: req.query,
          params: req.params,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        },
        priority: 1
      }).catch(err => console.error('Failed to log request:', err));
    }
    
    oldEnd.apply(res, arguments);
  };

  next();
};

// Error logger
const errorLogger = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Log to database
  DatabaseQueries.addJournalEntry({
    type: 'ERROR',
    title: 'Server Error',
    message: err.message,
    data: {
      method: req.method,
      path: req.path,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      ip: req.ip
    },
    priority: 5 // Critical
  }).catch(logErr => console.error('Failed to log error:', logErr));
  
  next(err);
};

module.exports = {
  morganMiddleware,
  requestLogger,
  responseLogger,
  errorLogger
};
