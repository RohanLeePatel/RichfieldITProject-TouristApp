require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const recommendationRoutes = require('./routes/recommendations');
const translationRoutes = require('./routes/translation');
const weatherRoutes = require('./routes/weather');
const { router: tripDocumentRoutes } = require('./routes/tripDocuments');
const rateLimit = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all incoming requests / frontends
app.use(cors());

// Middleware to parse JSON request bodies
app.use(express.json());

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Travel Assistant Backend API',
      version: '1.0.0',
      description: 'API documentation for travel planning, user authentication, itineraries, and expense tracking.',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Rate limits per IP: a broad cap on everything, tighter where abuse costs something.
app.use(rateLimit({ max: 300, windowMs: 60_000 }));

// Mount Routes
app.use('/api/auth', rateLimit({ max: 10, windowMs: 60_000 }), authRoutes); // password guessing / mass signups
app.use('/api/trips', tripRoutes);
// Documents are base64 in a JSON body, so this path needs a bigger limit than
// the global express.json() default (100kb) for a 1 MB file. Capped tighter
// than Vercel's ~4.5MB body limit; the route re-checks the decoded size.
app.use('/api/trips', express.json({ limit: '2mb' }), tripDocumentRoutes);
app.use('/api/recommendations', rateLimit({ max: 30, windowMs: 60_000 }), recommendationRoutes); // hits the AI service
app.use('/api/translate', translationRoutes);
app.use('/api/weather', rateLimit({ max: 60, windowMs: 60_000 }), weatherRoutes); // shared OpenWeather quota

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Travel Assistant Backend API is running smoothly!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Interactive API Docs available at http://localhost:${PORT}/api-docs`);
});