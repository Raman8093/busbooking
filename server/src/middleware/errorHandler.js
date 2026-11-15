function errorHandler(error, req, res, next) {
  if (
    error.statusCode >= 500 ||
    (!error.statusCode &&
      !['ValidationError', 'CastError', 'JsonWebTokenError', 'TokenExpiredError'].includes(error.name) &&
      error.code !== 11000)
  ) {
    console.error(error);
  }

  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this value already exists' });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid identifier format: ${error.path || 'field'}` });
  }

  if (error.name === 'ValidationError') {
    const messages = error.errors ? Object.values(error.errors).map((err) => err.message).filter(Boolean) : [];
    const message = messages.length ? messages.join('. ') : 'Please check the submitted values';
    return res.status(400).json({ success: false, message });
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Something went wrong on the server'
  });
}

module.exports = errorHandler;

