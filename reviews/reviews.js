const subjectSlug = document.body.dataset.subject || 'legacy';
const RATED_KEY = `ratedSite_${subjectSlug}`;

const STORAGE_VERSION = '2026_V1';
const currentVersion = localStorage.getItem('site_version');

if (currentVersion !== STORAGE_VERSION) {
    Object.keys(localStorage).forEach(key => {
        if (
            key === 'ratedSite' ||
            key.startsWith('ratedSite_') ||
            key.startsWith('review') ||
            key.startsWith('quiz') ||
            key === 'visitedChapters' ||
            key === 'openedChapters' ||
            key === 'trackedChapterIds'
        ) {
            localStorage.removeItem(key);
        }
    });
    localStorage.setItem('site_version', STORAGE_VERSION);
    console.log("✅ Site data cleared for new version:", STORAGE_VERSION);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize logic for tracking time and conditions
    initReviewTracking();
    
    // 2. Fetch and render reviews on homepage
    if (document.getElementById('testimonials-container')) {
        loadTestimonials();
    }
});

function initReviewTracking() {
    // Check if user already rated
    if (localStorage.getItem(RATED_KEY) === 'true') {
        return; // User already rated, do nothing
    }

    // Initialize session start time if not exists
    if (!localStorage.getItem('sessionStart')) {
        localStorage.setItem('sessionStart', Date.now());
    }

    // Check periodically if conditions are met
    setInterval(checkReviewConditions, 10000); // Check every 10 seconds
}

function checkReviewConditions() {
    // Condition 1: Already rated
    if (localStorage.getItem(RATED_KEY) === 'true') {
        return;
    }

    // Removed "Later" logic (reviewLaterTime) per requirements

    // Condition 3: Is currently in a quiz?
    if (window.isQuizOpen === true) {
        return; // Don't interrupt quiz
    }

    // Condition 4: Time spent (3 minutes = 180,000 ms)
    const sessionStart = parseInt(localStorage.getItem('sessionStart'));
    const timeSpent = Date.now() - sessionStart;
    
    // Condition 5: Chapters opened or Quiz finished
    const openedChapters = parseInt(localStorage.getItem('openedChapters') || '0');
    const quizFinished = localStorage.getItem('quizFinished') === 'true';

    // If already showing
    if (document.getElementById('review-popup-overlay')) {
        return;
    }

    if (timeSpent >= 180000 && (openedChapters >= 2 || quizFinished)) {
        initiateReviewProcess();
    }
}

// Track chapter openings automatically on read page
function trackOpenedChapters() {
    const chapterHeaders = document.querySelectorAll('.chapter-header');
    if (chapterHeaders.length > 0) {
        let trackedChapters = JSON.parse(localStorage.getItem('trackedChapterIds') || '[]');
        chapterHeaders.forEach((header, index) => {
            header.addEventListener('click', () => {
                if (!trackedChapters.includes(index)) {
                    trackedChapters.push(index);
                    localStorage.setItem('trackedChapterIds', JSON.stringify(trackedChapters));
                    localStorage.setItem('openedChapters', trackedChapters.length.toString());
                }
            });
        });
    }
}

// Call chapter tracking initializer
document.addEventListener('DOMContentLoaded', () => {
    trackOpenedChapters();
});

// Function to trigger immediately after a quiz finishes with high score (called externally)
window.triggerReviewAfterQuiz = function() {
    if (localStorage.getItem(RATED_KEY) !== 'true') {
        setTimeout(() => {
            initiateReviewProcess();
        }, 1500); // Small delay after closing quiz result
    }
}

async function initiateReviewProcess() {
    if (document.getElementById('review-popup-overlay')) return;
    
    const fp = await generateFingerprint();
    
    try {
        const response = await fetch(`${APP_BASE_PATH}/reviews/generate_token.php?fp=${encodeURIComponent(fp)}&subject=${encodeURIComponent(subjectSlug)}`);
        const data = await response.json();
        
        if (data && data.success && data.token) {
            showReviewPopup(data.token, fp);
        } else {
            console.warn("Could not retrieve review token:", data.message);
            // Hide forever if already rated or permanently banned
            if (data.message === 'ALREADY_RATED' || data.message === 'PERMANENT_BAN') {
                localStorage.setItem(RATED_KEY, 'true');
            }
        }
    } catch (e) {
        console.error("Token fetch failed.");
    }
}

async function generateFingerprint() {
    const nav = window.navigator;
    const screen = window.screen;
    let raw = nav.userAgent + nav.language + screen.colorDepth + screen.width + screen.height + new Date().getTimezoneOffset();
    try {
        const msgBuffer = new TextEncoder().encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return btoa(raw).substring(0, 128);
    }
}

let selectedRating = 0;

function showReviewPopup(token = '', fingerprint = '') {
    if (!token) {
        console.warn("Security Warning: Popup triggered without token. Submissions will be rejected by server.");
    }
    if (document.getElementById('review-popup-overlay')) return;

    const popupHTML = `
        <div class="review-popup-overlay" id="review-popup-overlay">
            <div class="review-popup-sheet">
                <div class="review-popup-drag"></div>
                <h3>هل ساعدك الموقع؟ ⭐</h3>
                <p id="review-desc">شارك تقييمك وساعدنا نحسن التجربة.</p>
                
                <div class="review-stars-container" id="review-stars">
                    <span class="star" data-val="5">★</span>
                    <span class="star" data-val="4">★</span>
                    <span class="star" data-val="3">★</span>
                    <span class="star" data-val="2">★</span>
                    <span class="star" data-val="1">★</span>
                </div>

                <textarea id="review-comment" class="review-textarea" placeholder="(اختياري) اكتب رأيك أو اقتراحك..."></textarea>
                
                <div class="review-btns">
                    <button class="review-btn review-btn-submit" id="btn-submit-review" disabled>تأكيد التقييم</button>
                </div>
                
                <div id="review-msg" class="review-msg"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHTML);

    const overlay = document.getElementById('review-popup-overlay');
    if (!overlay) return; // safety

    const stars = document.querySelectorAll('.review-stars-container .star');
    const submitBtn = document.getElementById('btn-submit-review');
    const commentBox = document.getElementById('review-comment');
    const msgBox = document.getElementById('review-msg');

    if (!submitBtn || !msgBox) return; // essential elements must exist

    // Prevent closing until explicitly allowed after successful submit
    overlay.dataset.allowClose = 'false';

    // Key handler to block Escape and similar
    const keyHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    document.addEventListener('keydown', keyHandler, true);

    // Ensure clicks on overlay/sheet don't close it or propagate
    overlay.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
    const sheet = overlay.querySelector('.review-popup-sheet');
    if (sheet) sheet.addEventListener('click', (e) => { e.stopPropagation(); });

    // Trigger animation
    setTimeout(() => {
        overlay.classList.add('active');
    }, 50);

    // Star logic (RTL visually because of row-reverse, but logic is based on data-val)
    if (stars && stars.length > 0) {
        stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            let val = parseInt(this.getAttribute('data-val'));
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-val')) <= val) {
                    s.classList.add('hover-active');
                } else {
                    s.classList.remove('hover-active');
                }
            });
        });

        star.addEventListener('mouseout', function() {
            stars.forEach(s => s.classList.remove('hover-active'));
        });

        star.addEventListener('click', function() {
            selectedRating = parseInt(this.getAttribute('data-val'));
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-val')) <= selectedRating) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
            submitBtn.disabled = false;

            const descBox = document.getElementById('review-desc');
            if (selectedRating <= 3) {
                if (descBox) descBox.innerHTML = 'شارك تقييمك وساعدنا نحسن التجربة.<br><span style="color: red;">اكتب سبب تقييمك (10 أحرف على الأقل مع الالتزام بالآداب العامة).</span>';
                if (commentBox) {
                    commentBox.placeholder = '(مطلوب) اكتب سبب التقييم هنا...';
                    commentBox.setAttribute('required', 'true');
                    commentBox.setAttribute('minlength', '10');
                }
            } else {
                if (descBox) descBox.innerHTML = 'شارك تقييمك وساعدنا نحسن التجربة.';
                if (commentBox) {
                    commentBox.placeholder = '(اختياري) اكتب رأيك أو اقتراحك...';
                    commentBox.removeAttribute('required');
                }
            }
        });
        });
    } else {
        // No stars -> disable submit to prevent accidental close
        submitBtn.disabled = true;
    }

    // Submit handler (guarded)
    submitBtn.addEventListener('click', async () => {
        // Rating is mandatory
        if (selectedRating === 0) return;

        const comment = commentBox ? commentBox.value.trim() : '';

        if (selectedRating <= 3) {
            if (comment.length < 10) {
                msgBox.innerText = 'عذراً، يجب أن يحتوي سبب التقييم على 10 أحرف على الأقل.';
                msgBox.className = 'review-msg error';
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'جاري الإرسال...';
        msgBox.className = 'review-msg';

        try {
            const response = await fetch(`${APP_BASE_PATH}/reviews/submit_review.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    rating: selectedRating, 
                    comment: comment, 
                    subject: subjectSlug,
                    token: token,
                    fingerprint: fingerprint
                })
            });

            const result = await response.json();

            if (result && result.success) {
                msgBox.innerText = result.message || 'تم حفظ التقييم.';
                msgBox.classList.add('success');
                localStorage.setItem(RATED_KEY, 'true');

                // Refresh testimonials if on homepage
                if (document.getElementById('testimonials-container')) {
                    loadTestimonials();
                }

                // Allow closing and remove key handler, then close
                overlay.dataset.allowClose = 'true';
                document.removeEventListener('keydown', keyHandler, true);
                setTimeout(() => { closePopup(overlay); }, 1200);
            } else if (result && result.message && result.message.includes('مسبقاً')) {
                // User already rated (caught by server IP check) -> hide and never show again
                msgBox.innerText = result.message;
                msgBox.classList.add('success');
                localStorage.setItem(RATED_KEY, 'true');
                
                overlay.dataset.allowClose = 'true';
                document.removeEventListener('keydown', keyHandler, true);
                setTimeout(() => { closePopup(overlay); }, 2000); // Wait 2s to let them read the message
            } else {
                msgBox.innerText = (result && result.message) ? result.message : 'فشل الإرسال.';
                msgBox.classList.add('error');
                submitBtn.disabled = false;
                submitBtn.innerText = 'تأكيد التقييم';
            }
        } catch (error) {
            msgBox.innerText = 'حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.';
            msgBox.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.innerText = 'تأكيد التقييم';
        }
    });
}

function closePopup(overlay) {
    if (!overlay) return;
    // Only allow close if explicitly permitted (set after successful submit)
    if (overlay.dataset && overlay.dataset.allowClose !== 'true') return;

    overlay.classList.remove('active');
    setTimeout(() => {
        try { overlay.remove(); } catch (e) { /* ignore */ }
    }, 500); // Wait for transition
}

let lastReviewId = 0;
let oldestReviewId = 0;
let totalReviewsAvailable = 0;
let isLoadingMoreReviews = false;
const REVIEWS_PAGE_SIZE = 20;

// Smart Polling Variables
let reviewPollInterval = 15000; // Start at 15s
let reviewPollTimer = null;
let reviewAbortController = null;
let isPollingReviews = false;

//local testing path


// const APP_BASE_PATH = 'http://127.0.0.1/%d8%a7%d9%84%d9%85%d9%88%d9%82%d8%b9%20%d8%a7%d9%84%d8%b4%d8%a7%d9%85%d9%84/'; // Adjust this to your actual base path if needed

//domains testing path


const APP_BASE_PATH = 'https://github.com/Val-Zir0/edu-finals/tree/main'; // Adjust this to your actual base path if needed

async function loadTestimonials() {
    const container = document.getElementById('testimonials-container');
    if (!container) return;

    try {
        const response = await fetch(`${APP_BASE_PATH}/reviews/get_reviews.php`);
        const data = await response.json();
        
        if (data.success && data.total_reviews > 0) {
            totalReviewsAvailable = data.total_reviews;

            if (data.reviews.length > 0) {
                lastReviewId = data.reviews[0].id; // The newest review is first
                oldestReviewId = data.reviews[data.reviews.length - 1].id;
            }
            
            // Build the HTML framework
            let html = `
                <div class="testimonials-header">
                    <h2>آراء الطلاب</h2>
                    <div class="testimonials-stats">
                        <div class="stats-score" id="live-avg-rating">${data.average_rating} / 5 ⭐</div>
                        <div class="stats-sub" id="live-total-reviews">بناءً على ${data.total_reviews} تقييم</div>
                    </div>
                </div>
                <div class="testimonials-grid" id="live-reviews-grid">
            `;
            
            data.reviews.forEach(review => {
                html += generateReviewCardHTML(review, false);
            });
            
            html += `</div>
                <div class="testimonials-actions" id="testimonials-actions"></div>
            `;
            container.innerHTML = html;
            
            updateLoadMoreButton();

            updateLoadMoreButton();

            // Start smart polling if not started
            if (!reviewPollTimer) {
                scheduleReviewPoll();
            }
        } else {
            container.innerHTML = ''; // Hide if no reviews
        }
    } catch (error) {
        console.error('Failed to load testimonials:', error);
    }
}

function updateLoadMoreButton() {
    const actions = document.getElementById('testimonials-actions');
    const grid = document.getElementById('live-reviews-grid');
    if (!actions || !grid) return;

    const loadedCount = grid.children.length;
    if (loadedCount < totalReviewsAvailable) {
        actions.innerHTML = `<button id="load-more-reviews-btn" class="load-more-reviews-btn">عرض المزيد</button>`;
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');
        if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreReviews);
    } else {
        actions.innerHTML = '';
    }
}

async function loadMoreReviews() {
    if (isLoadingMoreReviews || !oldestReviewId) return;

    const loadMoreBtn = document.getElementById('load-more-reviews-btn');
    if (!loadMoreBtn) return;

    isLoadingMoreReviews = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerText = 'جاري التحميل...';

    try {
        const response = await fetch(`${APP_BASE_PATH}/reviews/get_reviews.php?before_id=${oldestReviewId}`);
        const data = await response.json();

        if (data.success && data.reviews.length > 0) {
            const grid = document.getElementById('live-reviews-grid');
            data.reviews.forEach(review => {
                grid.insertAdjacentHTML('beforeend', generateReviewCardHTML(review, false));
            });

            oldestReviewId = data.reviews[data.reviews.length - 1].id;
            updateLoadMoreButton();
        } else {
            const actions = document.getElementById('testimonials-actions');
            if (actions) actions.innerHTML = '';
        }
    } catch (error) {
        console.error('Failed to load more reviews:', error);
        loadMoreBtn.innerText = 'حاول مرة أخرى';
    } finally {
        isLoadingMoreReviews = false;
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerText = 'عرض المزيد';
        }
    }
}

function generateReviewCardHTML(review, isNew = false) {
    let starsHTML = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const avatarSvg = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    
    let animClass = isNew ? ' new-review-anim' : '';
    
    let html = `
        <div class="testimonial-card${animClass}">
            <div class="t-card-header">
                <div class="t-avatar">${avatarSvg}</div>
                <div class="t-user-info">
                    <div class="t-name">${review.student_name}</div>
                    <div class="t-date">${review.formatted_date}</div>
                </div>
                <div class="t-stars">${starsHTML}</div>
            </div>
    `;
    
    if (review.comment && review.comment.trim() !== '') {
        let safeComment = review.comment.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html += `<div class="t-comment">${safeComment}</div>`;
    }
    
    html += `</div>`;
    return html;
}

function scheduleReviewPoll() {
    clearTimeout(reviewPollTimer);
    reviewPollTimer = setTimeout(pollReviews, reviewPollInterval);
}

async function pollReviews() {
    // Smart Polling: Pause if tab is inactive or currently polling
    if (document.visibilityState !== 'visible' || isPollingReviews) {
        scheduleReviewPoll();
        return;
    }

    isPollingReviews = true;
    if (reviewAbortController) reviewAbortController.abort();
    reviewAbortController = new AbortController();

    try {
        const response = await fetch(`${APP_BASE_PATH}/reviews/get_reviews.php?last_id=${lastReviewId}`, {
            signal: reviewAbortController.signal,
            cache: 'no-store'
        });
        const data = await response.json();
        
        if (data.success) {
            const grid = document.getElementById('live-reviews-grid');
            const avgEl = document.getElementById('live-avg-rating');
            const totalEl = document.getElementById('live-total-reviews');
            
            if (!grid || !avgEl || !totalEl) {
                isPollingReviews = false;
                scheduleReviewPoll();
                return;
            }

            let changed = false;

            // Check if stats changed
            let currentAvg = avgEl.innerText.split(' ')[0];
            // Format data.average_rating to match the string comparison
            if (currentAvg != data.average_rating) {
                avgEl.innerText = `${data.average_rating} / 5 ⭐`;
                avgEl.classList.remove('stat-update-anim');
                void avgEl.offsetWidth; // trigger reflow
                avgEl.classList.add('stat-update-anim');
                changed = true;
            }

            let currentTotal = totalEl.innerText.replace(/[^0-9]/g, '');
            if (currentTotal != data.total_reviews) {
                totalEl.innerText = `بناءً على ${data.total_reviews} تقييم`;
                totalReviewsAvailable = data.total_reviews;
                changed = true;
            }

            // Check if there are new reviews to insert
            if (data.reviews && data.reviews.length > 0) {
                const newReviews = [...data.reviews].reverse(); 
                
                newReviews.forEach(review => {
                    const cardHTML = generateReviewCardHTML(review, true);
                    grid.insertAdjacentHTML('afterbegin', cardHTML);
                });
                
                lastReviewId = data.reviews[0].id;
                changed = true;
            }

            updateLoadMoreButton();

            // Adaptive polling logic
            if (changed) {
                reviewPollInterval = Math.max(reviewPollInterval - 5000, 10000); // More activity -> poll faster (min 10s)
            } else {
                reviewPollInterval = Math.min(reviewPollInterval + 5000, 60000); // Less activity -> poll slower (max 60s)
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            // Silent fail for polling to prevent console spam
        }
    } finally {
        isPollingReviews = false;
        scheduleReviewPoll();
    }
}

// Add visibility event listener to resume instantly when visible
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible' && reviewPollTimer) {
        clearTimeout(reviewPollTimer);
        pollReviews();
    }
});
