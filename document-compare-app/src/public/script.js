document.addEventListener('DOMContentLoaded', () => {
    // Add marked.js library
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(markedScript);

    const uploadForm = document.getElementById('uploadForm');
    const comparisonResult = document.getElementById('comparisonResult');
    const chatForm = document.getElementById('chatInterface');
    const chatInput = document.getElementById('chatInput');
    const chatResponse = document.getElementById('chatResponse');

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        comparisonResult.innerHTML = '<div class="loading">Processing documents...</div>';
        const formData = new FormData();
        
        const file1 = document.getElementById('file1').files[0];
        const file2 = document.getElementById('file2').files[0];
        
        // Add file information logging
        console.log('File 1:', {
            name: file1.name,
            type: file1.type,
            size: `${(file1.size / 1024).toFixed(2)} KB`
        });
        console.log('File 2:', {
            name: file2.name,
            type: file2.type,
            size: `${(file2.size / 1024).toFixed(2)} KB`
        });
        
        formData.append('documents', file1);
        formData.append('documents', file2);

        try {
            console.log('Starting document upload...');
            comparisonResult.innerHTML = '<div class="loading">Uploading documents...</div>';
            
            console.time('documentUpload');
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            console.timeEnd('documentUpload');
            
            console.log('Upload response status:', response.status);
            
            const data = await response.json();
            if (data.error) {
                console.error('Upload error:', data.error);
                comparisonResult.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                return;
            }

            console.log('Documents processed successfully');
            console.log('Document 1 length:', data.documents[0].length);
            console.log('Document 2 length:', data.documents[1].length);

            // Display documents in the viewers
            document.getElementById('document1Content').innerHTML = `<pre>${data.documents[0]}</pre>`;
            document.getElementById('document2Content').innerHTML = `<pre>${data.documents[1]}</pre>`;

            console.log('Documents processed, starting comparison...');
            comparisonResult.innerHTML = '<div class="loading">Comparing documents...</div>';
            
            const compareResponse = await fetch('/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    doc1: data.documents[0],
                    doc2: data.documents[1]
                })
            });
            
            // Update the comparison result rendering
            const compareData = await compareResponse.json();
            if (compareData.error) {
                comparisonResult.innerHTML = `<div class="error">${compareData.error}</div>`;
                return;
            }
            
            // Render markdown response
            comparisonResult.innerHTML = marked.parse(compareData.comparisonResult);
            console.log('Comparison complete');
            
            if (compareData.comparisonResult) {
                document.getElementById('chatInterface').style.display = 'block';
            }
        } catch (error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            comparisonResult.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
    });

    document.getElementById('sendChat').addEventListener('click', async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            if (data.error) {
                chatResponse.innerHTML += `<p class="error">${data.error}</p>`;
                return;
            }
            
            chatResponse.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
            chatResponse.innerHTML += `<div class="ai-response">${marked.parse(data.response)}</div>`;
            chatInput.value = '';
        } catch (error) {
            chatResponse.innerHTML += '<p class="error">Error sending message</p>';
        }
    });
});
