const axios = require('axios');

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

async function compareDocuments(doc1, doc2) {
    console.log('Comparing documents with Azure OpenAI...');
    
    // Ensure we have string content
    const text1 = typeof doc1 === 'string' ? doc1 : JSON.stringify(doc1);
    const text2 = typeof doc2 === 'string' ? doc2 : JSON.stringify(doc2);
    
    console.log('Document 1 excerpt:', text1.substring(0, 100) + '...');
    console.log('Document 2 excerpt:', text2.substring(0, 100) + '...');

    try {
        const payload = {
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that compares two documents and provides a detailed analysis of their similarities and differences. Format your response in markdown with appropriate headers, lists, and emphasis. Use markdown features like ## for sections, * for lists, and ` for code or specific terms."
                },
                {
                    role: "user",
                    content: `Compare these two documents and provide a structured analysis with the following sections in markdown format:

## Summary
## Key Similarities
## Key Differences
## Detailed Analysis
## Recommendations

Documents to compare:

Document 1:
${text1}

Document 2:
${text2}`
                }
            ],
            max_tokens: 800,
            temperature: 0.7,
        };

        console.log('Sending request to Azure OpenAI...');
        const response = await axios.post(
            `${AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview`,
            payload,
            {
                headers: {
                    'api-key': AZURE_OPENAI_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Received response from Azure OpenAI');
        const result = response.data.choices[0].message.content;
        console.log('Comparison result:', result);
        return result;
    } catch (error) {
        console.error('Error in compareDocuments:', error.response?.data || error.message);
        throw new Error(`Failed to compare documents: ${error.message}`);
    }
}

async function chatWithContext(message, doc1Content, doc2Content) {
    try {
        const payload = {
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant analyzing two documents. 
                    Here are the contents of the documents:
                    Document 1: ${doc1Content}
                    Document 2: ${doc2Content}
                    Please answer questions about these documents.`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            max_tokens: 800,
            temperature: 0.7,
        };

        const response = await axios.post(
            `${AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview`,
            payload,
            {
                headers: {
                    'api-key': AZURE_OPENAI_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error in chatWithContext:', error.response?.data || error.message);
        throw new Error(`Failed to process chat: ${error.message}`);
    }
}

module.exports = {
    compareDocuments,
    chatWithContext,
};