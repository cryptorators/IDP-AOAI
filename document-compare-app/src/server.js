const path = require('path');
const { validateEnvFile } = require('./utils/env-validator');

// Validate and load .env file
const projectRoot = path.resolve(__dirname, '..');
const envPath = validateEnvFile(projectRoot);
delete require.cache[require.resolve('dotenv')];
require('dotenv').config({ path: envPath, debug: process.env.DEBUG });

// Validate required environment variables
const requiredEnvVars = [
    'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
    'AZURE_DOCUMENT_INTELLIGENCE_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars);
    process.exit(1);
}

// Debug logging with redacted values
console.log('Environment variables loaded from:', envPath);
console.log('Loaded variables:');
requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    const redactedValue = value ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : 'NOT SET';
    console.log(`${envVar}: ${redactedValue}`);
});

const express = require('express');
const multer = require('multer');
const { processDocument } = require('./services/document-processor');
const { compareDocuments } = require('./services/azure-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Express to handle larger payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Update Multer configuration with size limits
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 2 // Maximum 2 files
    }
});

// Error handling middleware for file size errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size is too large. Maximum size is 50MB.' });
        }
    }
    next(error);
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add this before app.listen():
app.use(express.json());

// Add this near your other route declarations:
let processedDocuments = null;

// Update the upload endpoint to store the processed documents
app.post('/upload', upload.array('documents', 2), async (req, res) => {
    try {
        console.log('Processing uploaded documents...');
        if (!req.files || req.files.length !== 2) {
            throw new Error('Exactly 2 files are required');
        }

        const documents = await Promise.all(req.files.map(async (file, index) => {
            console.log(`Processing document ${index + 1}...`);
            return processDocument(file.buffer);
        }));

        console.log('Documents processed successfully');
        processedDocuments = documents;
        res.json({ documents });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Error processing documents' });
    }
});

// Endpoint for comparing documents
app.post('/compare', async (req, res) => {
    try {
        console.log('Received comparison request');
        const { doc1, doc2 } = req.body;
        
        if (!doc1 || !doc2) {
            throw new Error('Both documents are required for comparison');
        }

        const comparisonResult = await compareDocuments(doc1, doc2);
        console.log('Comparison completed successfully');
        res.json({ comparisonResult });
    } catch (error) {
        console.error('Comparison error:', error);
        res.status(500).json({ error: error.message || 'Error comparing documents' });
    }
});

// Update the chat endpoint
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (!processedDocuments) {
            res.status(400).json({ error: 'Please upload documents first' });
            return;
        }

        const response = await chatWithContext(
            message, 
            processedDocuments[0], 
            processedDocuments[1]
        );
        res.json({ response });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Error processing chat message' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});