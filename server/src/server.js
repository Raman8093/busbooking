require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');
const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error('The API will still start, but database features need MongoDB.');
  }

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

if (require.main === module) startServer();

module.exports = { app, startServer };

