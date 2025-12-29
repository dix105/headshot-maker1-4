document.addEventListener('DOMContentLoaded', () => {
    
    // =========================================
    // MOBILE MENU (EXISTING)
    // =========================================
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });
        
        // Close menu when clicking a link
        document.querySelectorAll('header nav a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // =========================================
    // BACKEND & PLAYGROUND LOGIC
    // =========================================

    // --- CONFIGURATION ---
    const API_BASE_URL = 'https://api.chromastudio.ai';
    const UPLOAD_BASE_URL = 'https://contents.maxstudio.ai';
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const EFFECT_ID = 'mugshot';
    
    // --- GLOBAL STATE ---
    let currentUploadedUrl = null;

    // --- DOM ELEMENTS ---
    const dropZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const uploadContent = document.querySelector('.upload-content');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    const loadingState = document.getElementById('loading-state');
    const placeholderText = document.querySelector('.placeholder-text');

    // --- CORE API FUNCTIONS ---

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL
        const signedUrlResponse = await fetch(
            `${API_BASE_URL}/get-emd-upload-url?fileName=${encodeURIComponent(fileName)}`,
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = `${UPLOAD_BASE_URL}/${fileName}`;
        return downloadUrl;
    }

    // Submit generation job
    async function submitImageGenJob(imageUrl) {
        const endpoint = `${API_BASE_URL}/image-gen`;
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            // Note: Browser controls User-Agent and sec-ch-ua headers automatically
        };

        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: EFFECT_ID,
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        return data;
    }

    // Poll job status
    async function pollJobStatus(jobId) {
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 60;
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${API_BASE_URL}/image-gen/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out');
    }

    // --- UI HELPERS ---

    function showLoading() {
        if (loadingState) loadingState.classList.remove('hidden');
        if (placeholderText) placeholderText.classList.add('hidden');
        
        // Ensure result is hidden while loading
        const resultImg = document.getElementById('result-final');
        if (resultImg) resultImg.classList.add('hidden');
    }

    function hideLoading() {
        if (loadingState) loadingState.classList.add('hidden');
    }

    function updateStatus(text) {
        // Update button text to reflect status
        if (generateBtn) {
            if (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING')) {
                generateBtn.disabled = true;
                generateBtn.textContent = text;
            } else if (text === 'READY') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'APPLY MUGSHOT EFFECT';
            } else if (text === 'COMPLETE') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'GENERATE AGAIN';
            } else if (text === 'ERROR') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'TRY AGAIN';
            }
        }
        
        // Also update any status text elements if they exist
        const statusText = document.querySelector('.status-text');
        if (statusText) statusText.textContent = text;
    }

    function showPreview(url) {
        const img = document.getElementById('preview-image');
        if (img) {
            img.src = url;
            if (previewContainer) previewContainer.classList.remove('hidden');
            if (uploadContent) uploadContent.classList.add('hidden');
        }
        
        // Hide result from previous run if any
        const resultImg = document.getElementById('result-final');
        if (resultImg) {
            resultImg.classList.add('hidden');
            resultImg.src = '';
        }
    }

    function showResultMedia(url) {
        const resultImg = document.getElementById('result-final');
        const container = document.getElementById('result-container') || document.querySelector('.result-area');
        
        const isVideo = url.toLowerCase().match(/\.(mp4|webm)(\?.*)?$/i);
        
        if (isVideo) {
            if (resultImg) resultImg.classList.add('hidden');
            
            let video = document.getElementById('result-video');
            if (!video) {
                video = document.createElement('video');
                video.id = 'result-video';
                video.controls = true;
                video.autoplay = true;
                video.loop = true;
                video.className = 'w-full h-auto rounded-lg shadow-lg';
                if (container) container.appendChild(video);
            }
            video.src = url;
            video.style.display = 'block';
        } else {
            const video = document.getElementById('result-video');
            if (video) video.style.display = 'none';
            
            if (resultImg) {
                resultImg.classList.remove('hidden');
                resultImg.src = url;
            }
        }
    }

    function showDownloadButton(url) {
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('hidden'); // Ensure it's visible if hidden via class
        }
    }

    function showError(msg) {
        alert(msg);
        updateStatus('ERROR');
    }

    // --- HANDLERS ---

    async function handleFileSelect(file) {
        try {
            // Verify file type
            if (!file.type.startsWith('image/')) {
                throw new Error('Please upload an image file');
            }

            showLoading();
            updateStatus('UPLOADING...');
            
            // Upload immediately
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            // Show preview
            showPreview(uploadedUrl);
            
            updateStatus('READY');
            hideLoading();
            
        } catch (error) {
            console.error(error);
            hideLoading();
            updateStatus('ERROR');
            alert(error.message);
        }
    }

    async function handleGenerate() {
        if (!currentUploadedUrl) {
            alert('Please upload an image first.');
            return;
        }
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            // Step 1: Submit job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            updateStatus('JOB QUEUED...');
            
            // Step 2: Poll for completion
            const result = await pollJobStatus(jobData.jobId);
            
            // Step 3: Extract result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.video || resultItem?.image;
            
            if (!resultUrl) {
                throw new Error('No result URL found in response');
            }
            
            // Step 4: Display Result
            showResultMedia(resultUrl);
            showDownloadButton(resultUrl);
            
            updateStatus('COMPLETE');
            hideLoading();
            
        } catch (error) {
            console.error(error);
            hideLoading();
            updateStatus('ERROR');
            alert(error.message);
        }
    }

    // --- EVENT WIRING ---

    // File Input
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
            // Reset input so same file can be selected again
            e.target.value = '';
        });
    }

    // Drag & Drop
    if (dropZone) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight/Unhighlight
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('highlight');
                dropZone.style.background = '#cbd5e1';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('highlight');
                dropZone.style.background = '';
            }, false);
        });

        // Handle Drop
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        }, false);
        
        // Handle Click (Trigger File Input)
        dropZone.addEventListener('click', (e) => {
            if (e.target !== resetBtn && fileInput) {
                fileInput.click();
            }
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            currentUploadedUrl = null;
            
            // Reset UI
            if (previewContainer) previewContainer.classList.add('hidden');
            if (uploadContent) uploadContent.classList.remove('hidden');
            if (loadingState) loadingState.classList.add('hidden');
            if (placeholderText) placeholderText.classList.remove('hidden');
            
            const resultImg = document.getElementById('result-final');
            if (resultImg) {
                resultImg.classList.add('hidden');
                resultImg.src = '';
            }
            
            const video = document.getElementById('result-video');
            if (video) video.style.display = 'none';
            
            if (downloadBtn) downloadBtn.disabled = true;
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'APPLY MUGSHOT EFFECT';
            }
        });
    }

    // Download Button - Robust Implementation
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            // Prevent default just in case
            e.preventDefault();
            
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
            
            try {
                // Strategy 1: Fetch as blob to force download
                const response = await fetch(url, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!response.ok) throw new Error('Network response was not ok');
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                // Determine extension
                const contentType = response.headers.get('content-type') || '';
                let extension = 'jpg';
                if (contentType.includes('png')) extension = 'png';
                else if (contentType.includes('webp')) extension = 'webp';
                else if (contentType.includes('video') || url.match(/\.mp4/i)) extension = 'mp4';
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `mugshot_result_${generateNanoId(6)}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Cleanup
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                
            } catch (err) {
                console.error('Download Strategy 1 failed:', err);
                
                // Strategy 2: Canvas Fallback (Images only)
                try {
                    const img = document.getElementById('result-final');
                    if (img && !img.classList.contains('hidden') && img.src === url) {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        
                        canvas.toBlob((blob) => {
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `mugshot_result_${generateNanoId(6)}.png`;
                            link.click();
                        }, 'image/png');
                        return; // Success
                    }
                } catch (canvasErr) {
                    console.error('Download Strategy 2 failed:', canvasErr);
                }
                
                // Strategy 3: Open in new tab
                alert('Direct download failed. Opening image in new tab - please right click and "Save Image As"');
                window.open(url, '_blank');
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }

    // =========================================
    // FAQ ACCORDION (EXISTING)
    // =========================================
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            question.classList.toggle('active');
            if (question.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + "px";
            } else {
                answer.style.maxHeight = 0;
            }
            faqQuestions.forEach(otherQuestion => {
                if (otherQuestion !== question && otherQuestion.classList.contains('active')) {
                    otherQuestion.classList.remove('active');
                    otherQuestion.nextElementSibling.style.maxHeight = 0;
                }
            });
        });
    });

    // =========================================
    // MODALS (EXISTING)
    // =========================================
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    const modalClosers = document.querySelectorAll('[data-modal-close]');
    
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = trigger.getAttribute('data-modal-target');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        });
    });
    
    modalClosers.forEach(closer => {
        closer.addEventListener('click', () => {
            const modalId = closer.getAttribute('data-modal-close');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    // =========================================
    // ANIMATIONS (EXISTING)
    // =========================================
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.step-card, .feature-card, .gallery-item, .testimonial-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .visible { opacity: 1 !important; transform: translateY(0) !important; }
    `;
    document.head.appendChild(styleSheet);
});