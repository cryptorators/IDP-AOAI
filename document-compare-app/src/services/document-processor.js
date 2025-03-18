const { default: DocumentIntelligence, getLongRunningPoller, isUnexpected } = require("@azure-rest/ai-document-intelligence");
const fs = require('fs');

// Debug logging
console.log('Loading Document Processor...');

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY;

// Debug logging
console.log('API Key type:', typeof apiKey);
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('Endpoint:', endpoint);

// Helper function to extract text from spans
function* getTextOfSpans(content, spans) {
    for (const span of spans) {
        yield content.slice(span.offset, span.offset + span.length);
    }
}

// Enhanced credential validation
function validateCredentials() {
    console.log('Validating Azure Document Intelligence credentials...');
    
    if (!endpoint || !endpoint.startsWith('https://')) {
        throw new Error('Invalid AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
    }

    if (!apiKey || apiKey.length < 10) {
        throw new Error('Invalid AZURE_DOCUMENT_INTELLIGENCE_API_KEY');
    }

    console.log('Credential validation passed successfully');
    return true;
}

// Initialize client
let client = null;
try {
    validateCredentials();
    client = DocumentIntelligence(endpoint, { 
        key: apiKey,
        apiVersion: "2023-10-31-preview"  // Adding explicit API version
    });
    console.log('Document Intelligence Client initialized successfully');
} catch (error) {
    console.error("Failed to initialize Document Intelligence Client:", error.message);
    throw error;
}

// Add after the initial constants
const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks

// Add before processDocument function
function chunkBase64(base64String) {
    const chunks = [];
    for (let i = 0; i < base64String.length; i += MAX_CHUNK_SIZE) {
        chunks.push(base64String.slice(i, i + MAX_CHUNK_SIZE));
    }
    return chunks;
}

async function processDocument(fileBuffer) {
    if (!client) {
        throw new Error("Document Intelligence Client not initialized");
    }

    try {
        console.log('Starting document processing...');
        const base64Source = fileBuffer.toString('base64');
        let operationLocation;
        let response;

        // Check if file size exceeds chunk size
        if (base64Source.length > MAX_CHUNK_SIZE) {
            console.log(`Large file detected (${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB), processing in chunks...`);
            const chunks = chunkBase64(base64Source);
            console.log(`Split into ${chunks.length} chunks`);
            
            // Process first chunk
            response = await client
                .path("/documentModels/{modelId}:analyze", "prebuilt-read")
                .post({
                    contentType: "application/json",
                    body: { 
                        base64Source: chunks[0],
                        pages: [1] // Start with first page
                    }
                });
            
            operationLocation = response.headers['operation-location'];
            if (!operationLocation) {
                throw new Error('No operation-location header in response');
            }

            // Process remaining chunks if needed
            if (chunks.length > 1) {
                console.log('Processing additional chunks...');
                for (let i = 1; i < chunks.length; i++) {
                    await client
                        .path("/documentModels/{modelId}:analyze", "prebuilt-read")
                        .post({
                            contentType: "application/json",
                            body: { 
                                base64Source: chunks[i],
                                pages: [i + 1] // Process subsequent pages
                            }
                        });
                }
            }
        } else {
            // Original processing for small files
            response = await client
                .path("/documentModels/{modelId}:analyze", "prebuilt-read")
                .post({
                    contentType: "application/json",
                    body: { base64Source }
                });

            operationLocation = response.headers['operation-location'];
            if (!operationLocation) {
                throw new Error('No operation-location header in response');
            }
        }

        // Rest of the existing polling and processing code
        let result;
        const maxRetries = 30;
        const pollInterval = 2000; // Poll every 2 seconds
        
        console.log('Waiting for document analysis to complete...');
        for (let retries = 0; retries < maxRetries; retries++) {
            const operationResponse = await client.path(operationLocation).get();
            const status = operationResponse.body.status;
            
            console.log(`Status check ${retries + 1}/${maxRetries}: ${status}`);
            
            if (status === "succeeded") {
                const result = operationResponse.body;
                console.log('Document analysis completed successfully');
                
                if (!result.analyzeResult) {
                    throw new Error('No analysis results in response');
                }
                
                const analyzeResult = result.analyzeResult;
                console.log(`Analysis complete: Found ${analyzeResult.pages?.length || 0} pages`);
                
                // Extract and format the text content
                let formattedContent = '';
                if (analyzeResult.pages) {
                    for (const page of analyzeResult.pages) {
                        if (page.lines) {
                            for (const line of page.lines) {
                                formattedContent += line.content + '\n';
                            }
                        }
                    }
                }
                
                return formattedContent.trim() || analyzeResult.content || '';
            }
            
            if (status === "failed") {
                throw new Error(`Analysis failed: ${operationResponse.body.error?.message || 'Unknown error'}`);
            }
            
            if (status !== "running") {
                throw new Error(`Unexpected status: ${status}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        throw new Error('Document analysis timed out');

        // Verify we have analysis results before proceeding
        if (!result.analyzeResult) {
            throw new Error('No analysis results in response');
        }

        const analyzeResult = result.analyzeResult;
        console.log(`Analysis complete: Found ${analyzeResult.pages?.length || 0} pages`);

        // Detailed logging of analysis results
        console.log('Content length:', analyzeResult?.content?.length || 0);
        console.log('Number of pages:', analyzeResult?.pages?.length || 0);
        if (analyzeResult?.pages?.length > 0) {
            console.log('First page sample:', {
                pageNumber: analyzeResult.pages[0].pageNumber,
                lineCount: analyzeResult.pages[0].lines?.length || 0,
                firstLine: analyzeResult.pages[0].lines?.[0]?.content || 'No content'
            });
        }

        const content = analyzeResult?.content;
        const pages = analyzeResult?.pages;
        const languages = analyzeResult?.languages;
        const styles = analyzeResult?.styles;

        console.log('Building formatted content...');
        let formattedContent = '';
        
        // Log progress through each processing stage
        if (pages && pages.length > 0) {
            console.log('Processing pages...');
            formattedContent += "Document Analysis:\n\n";
            for (const page of pages) {
                formattedContent += `Page ${page.pageNumber} (${page.width}x${page.height}, angle: ${page.angle}):\n`;
                if (page.lines?.length > 0) {
                    formattedContent += "Lines:\n";
                    for (const line of page.lines) {
                        formattedContent += `  ${line.content}\n`;
                    }
                }
                formattedContent += '\n';
            }
        }

        if (languages?.length > 0) {
            console.log('Processing languages...');
            formattedContent += "\nLanguages Detected:\n";
            for (const lang of languages) {
                formattedContent += `- ${lang.locale} (confidence: ${lang.confidence})\n`;
                for (const text of getTextOfSpans(content, lang.spans)) {
                    const escapedText = text.replace(/\r?\n/g, "\\n").replace(/"/g, '\\"');
                    formattedContent += `  "${escapedText}"\n`;
                }
            }
        }

        if (styles?.length > 0) {
            console.log('Processing styles...');
            formattedContent += "\nText Styles:\n";
            for (const style of styles) {
                formattedContent += `- Handwritten: ${style.isHandwritten ? "yes" : "no"} (confidence=${style.confidence})\n`;
                for (const word of getTextOfSpans(content, style.spans)) {
                    formattedContent += `  "${word}"\n`;
                }
            }
        }

        console.log('Formatted content length:', formattedContent.length);
        return formattedContent || content;

    } catch (error) {
        if (error.message?.includes('PayloadTooLargeError')) {
            throw new Error('File is too large to process. Maximum file size exceeded.');
        }
        console.error("Document processing error:", error);
        console.error("Error stack:", error.stack);
        throw new Error(`Document processing failed: ${error.message}`);
    }
}

module.exports = {
    processDocument,
    getTextOfSpans  // Exported for potential external use
};