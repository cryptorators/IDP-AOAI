# README.md

# Document Compare App

This project is a simple yet modern Node.js web application that allows users to upload two files, process them using Azure Document Intelligence for OCR, and compare the documents using Azure OpenAI's GPT-4 model. The application also features a chat interface for user inquiries regarding the uploaded documents.

![image](https://github.com/user-attachments/assets/06556fd1-c06e-4df9-9e5d-bb493add41b4)


## Project Structure

```
document-compare-app
├── src
│   ├── server.js                # Entry point of the application
│   ├── services
│   │   ├── azure-ai.js          # Functions to interact with Azure OpenAI services
│   │   └── document-processor.js # Functions for processing documents using Azure Document Intelligence
│   └── public
│       ├── index.html           # HTML structure of the web application
│       └── style.css            # Styles for the web application
├── package.json                  # Configuration file for npm
├── .env                          # Environment variables for sensitive information
└── README.md                     # Documentation for the project
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd document-compare-app
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Azure API keys:
   ```
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_DOCUMENT_INTELLIGENCE_API_KEY=your_api_key
   ```

4. Start the server:
   ```
   node src/server.js
   ```

5. Open your browser and navigate to `http://localhost:3000` to access the application.

## Usage

- Upload two documents using the provided form.
- Click the "Compare Documents" button to process and compare the uploaded files.
- Use the chat interface to ask questions about the documents.

## License

This project is licensed under the MIT License.
