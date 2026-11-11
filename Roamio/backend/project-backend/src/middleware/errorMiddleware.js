// Error handler for the admin router. It answers with the admin dashboard's
// { success, status, message } shape. The app-wide handler lives in server.js.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) console.error(err.stack);
  const message = statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed');

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;